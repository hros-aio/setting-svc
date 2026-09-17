import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { isDateString } from 'class-validator';
import { EffectiveDateUtil } from '../../../common/utils/effective-date.util';
import {
  AggregateType,
  ChangeOperation,
  EffectiveChangeEventType,
  EffectiveChangeStatus,
  MasterDataStatus,
  OutboxStatus,
  PocType,
  SetupStepType,
} from '../../../enums';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { OutboxEventRepository } from '../../company/repositories/outbox-event.repository';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { EmployeeReferenceRepository } from '../../employee-reference/repositories/employee-reference.repository';
import { CreatePocDto } from '../dtos/create-poc.dto';
import { DeactivatePocDto } from '../dtos/deactivate-poc.dto';
import { ReplacePocDto } from '../dtos/replace-poc.dto';
import { PocEntity } from '../entities/poc.entity';
import { PocRepository } from '../repositories/poc.repository';

@Injectable()
export class PocService {
  private readonly logger = new Logger(PocService.name);

  constructor(
    private readonly transactionService: TransactionService,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly pocRepository: PocRepository,
    private readonly employeeReferenceRepository: EmployeeReferenceRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly companySetupStepRepository: CompanySetupStepRepository,
    private readonly effectiveChangeRepository: EffectiveChangeRepository,
  ) {}

  async create(companyId: string, dto: CreatePocDto): Promise<PocEntity> {
    const userId = RequestContextService.getUser().userId;
    const tenantCode = RequestContextService.getTenantCode();

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(companyId, dto.effectiveAt);

    // 2. Validate pocType in allow-list
    if (!Object.values(PocType).includes(dto.pocType)) {
      throw new BadRequestException(`Invalid pocType: ${dto.pocType}`);
    }

    // 3. Verify employee exists in local read projection & is active
    await this.verifyEmployeeReference(dto.employeeId);

    // 4. Verify no active or scheduled assignment currently exists for this type in this company
    const existing = await this.pocRepository.findByCompanyAndType(companyId, dto.pocType);
    if (existing) {
      throw new ConflictException(
        `An active or scheduled Point of Contact already exists for responsibility type '${dto.pocType}' in this company`,
      );
    }

    return this.transactionService.runInTransaction(async () => {
      // 5. Persist Poc in scheduled status
      const poc = await this.pocRepository.create({
        tenantCode,
        companyId,
        pocType: dto.pocType,
        employeeId: dto.employeeId,
        status: MasterDataStatus.SCHEDULED,
        effectiveAt: effectiveAtDate,
        createdBy: userId,
        updatedBy: userId,
      });

      // 6. Complete POC setup step (Step 8)
      await this.companySetupStepRepository.markStepCompleted({
        companyId,
        stepType: SetupStepType.POC,
        completedBy: userId,
      });

      // 7. Write outbox event for scheduling
      await this.outboxEventRepository.create({
        aggregateType: AggregateType.POC,
        aggregateId: poc.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: poc.id,
          entityType: 'poc',
          operation: 'CREATE',
          effectiveAt: poc.effectiveAt,
          targetCompanyId: companyId,
          tenantCode,
        },
        executionTime: poc.effectiveAt,
        status: OutboxStatus.PENDING,
      });

      this.logger.log(
        `Scheduled initial PoC assignment for ${dto.pocType} (id: ${poc.id}) in company ${companyId}`,
      );

      return poc;
    });
  }

  async replace(
    companyId: string,
    pocId: string,
    dto: ReplacePocDto,
  ): Promise<EffectiveChangeEntity> {
    const userId = RequestContextService.getUser().userId;
    const tenantCode = RequestContextService.getTenantCode();

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(companyId, dto.effectiveAt);

    // 2. Verify target PoC is active (or scheduled)
    const poc = await this.verifyPocExists(pocId);
    if (poc.status === MasterDataStatus.INACTIVE) {
      throw new BadRequestException(`Cannot schedule replacement for an INACTIVE Point of Contact`);
    }

    // 3. Verify new employee exists in projection
    await this.verifyEmployeeReference(dto.newEmployeeId);

    // 4. Verify no pending change exists for this PoC (BR-13)
    await this.verifyNoPendingChange(companyId, pocId, 'scheduling replacement');

    return this.transactionService.runInTransaction(async () => {
      const savedChange = await this.effectiveChangeRepository.create({
        tenantCode,
        companyId,
        entityType: 'poc',
        entityId: poc.id,
        operation: ChangeOperation.UPDATE,
        payload: {
          newEmployeeId: dto.newEmployeeId,
          reason: dto.reason,
          pocType: poc.pocType,
        },
        status: EffectiveChangeStatus.SCHEDULED,
        effectiveAt: effectiveAtDate,
        expectedUpdatedAt: poc.updatedAt,
        createdBy: userId,
      });

      // Write outbox event
      await this.outboxEventRepository.create({
        aggregateType: AggregateType.EFFECTIVE_CHANGE,
        aggregateId: savedChange.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: savedChange.id,
          entityType: 'poc',
          operation: 'UPDATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantCode,
        },
        executionTime: savedChange.effectiveAt,
        status: OutboxStatus.PENDING,
      });

      this.logger.log(
        `Scheduled replacement for PoC ${poc.pocType} (${pocId}) in company ${companyId}`,
      );

      return savedChange;
    });
  }

  async deactivate(
    companyId: string,
    pocId: string,
    dto: DeactivatePocDto,
  ): Promise<EffectiveChangeEntity> {
    const userId = RequestContextService.getUser().userId;
    const tenantCode = RequestContextService.getTenantCode();

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(companyId, dto.effectiveAt);

    // 2. Verify target PoC exists and is active
    const poc = await this.verifyPocExists(pocId);
    if (poc.status === MasterDataStatus.INACTIVE) {
      throw new BadRequestException(`Point of Contact is already INACTIVE`);
    }

    // 3. Verify no pending change exists (BR-13)
    await this.verifyNoPendingChange(companyId, pocId, 'scheduling deactivation');

    return this.transactionService.runInTransaction(async () => {
      const savedChange = await this.effectiveChangeRepository.create({
        tenantCode,
        companyId,
        entityType: 'poc',
        entityId: poc.id,
        operation: ChangeOperation.DEACTIVATE,
        payload: {
          reason: dto.reason,
          pocType: poc.pocType,
        },
        status: EffectiveChangeStatus.SCHEDULED,
        effectiveAt: effectiveAtDate,
        expectedUpdatedAt: poc.updatedAt,
        createdBy: userId,
      });

      // Write outbox event
      await this.outboxEventRepository.create({
        aggregateType: AggregateType.EFFECTIVE_CHANGE,
        aggregateId: savedChange.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: savedChange.id,
          entityType: 'poc',
          operation: 'DEACTIVATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantCode,
        },
        executionTime: savedChange.effectiveAt,
        status: OutboxStatus.PENDING,
      });

      this.logger.log(
        `Scheduled deactivation for PoC ${poc.pocType} (${pocId}) in company ${companyId}`,
      );

      return savedChange;
    });
  }

  private async validateEffectiveDate(
    companyId: string,
    effectiveAt: string,
  ): Promise<{ effectiveAtDate: Date; timezone: string }> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new NotFoundException(`Company '${companyId}' not found`);
    }

    if (!isDateString(effectiveAt)) {
      throw new BadRequestException('Invalid effectiveAt date format');
    }

    const effectiveAtDate = new Date(effectiveAt);
    const tz = company.timezone || 'UTC';
    const validation = EffectiveDateUtil.validateFutureEffectiveDate(effectiveAtDate, tz);
    if (!validation.isValid) {
      throw new BadRequestException(
        `Effective date must be strictly in the future (on or after end of current business day in ${tz})`,
      );
    }

    return {
      effectiveAtDate,
      timezone: tz,
    };
  }

  private async verifyEmployeeReference(employeeId: string): Promise<void> {
    const tenantId = RequestContextService.getTenantCode();
    const employee = await this.employeeReferenceRepository.findByEmployeeId(tenantId, employeeId);
    if (!employee) {
      throw new NotFoundException(
        `Referenced employee '${employeeId}' not found in tenant '${tenantId}'`,
      );
    }
    if (employee.employmentStatus && employee.employmentStatus.toUpperCase() === 'TERMINATED') {
      throw new BadRequestException(
        `Referenced employee '${employeeId}' is terminated and cannot be assigned as Point of Contact`,
      );
    }
  }

  private async verifyPocExists(pocId: string): Promise<PocEntity> {
    const poc = await this.pocRepository.findById(pocId);
    if (!poc) {
      throw new NotFoundException(`Point of Contact '${pocId}' not found`);
    }
    return poc;
  }

  private async verifyNoPendingChange(
    companyId: string,
    pocId: string,
    action: string,
  ): Promise<void> {
    const pendingChange = await this.effectiveChangeRepository.findPendingChange(
      companyId,
      'poc',
      pocId,
    );
    if (pendingChange) {
      throw new ConflictException(
        `Cannot proceed with ${action}: Point of Contact '${pocId}' already has a pending scheduled change (ID: ${pendingChange.id})`,
      );
    }
  }
}
