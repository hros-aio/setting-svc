import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource } from 'typeorm';
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
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
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
    private readonly dataSource: DataSource,
    private readonly transactionService: TransactionService,
    private readonly pocRepository: PocRepository,
    private readonly employeeReferenceRepository: EmployeeReferenceRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly companySetupStepRepository: CompanySetupStepRepository,
    private readonly effectiveChangeRepository: EffectiveChangeRepository,
  ) {}

  async create(
    companyId: string,
    dto: CreatePocDto,
    authContext?: AuthContext | null,
  ): Promise<PocEntity> {
    const userId = authContext?.userId;
    const tenantId = this.resolveTenantId(authContext);

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(
      tenantId,
      companyId,
      dto.effectiveAt,
    );

    // 2. Validate pocType in allow-list
    if (!Object.values(PocType).includes(dto.pocType)) {
      throw new BadRequestException(`Invalid pocType: ${dto.pocType}`);
    }

    // 3. Verify employee exists in local read projection & is active
    await this.verifyEmployeeReference(tenantId, companyId, dto.employeeId);

    // 4. Verify no active or scheduled assignment currently exists for this type in this company
    const existing = await this.pocRepository.findByCompanyAndType(
      tenantId,
      companyId,
      dto.pocType,
    );
    if (existing) {
      throw new ConflictException(
        `An active or scheduled Point of Contact already exists for responsibility type '${dto.pocType}' in this company`,
      );
    }

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      // 5. Persist Poc in scheduled status
      const poc = await this.pocRepository.createAndSave(
        {
          tenantId,
          companyId,
          pocType: dto.pocType,
          employeeId: dto.employeeId,
          status: MasterDataStatus.SCHEDULED,
          effectiveAt: effectiveAtDate,
          createdBy: userId,
          updatedBy: userId,
        },
        manager,
      );

      // 6. Complete POC setup step (Step 8)
      await this.companySetupStepRepository.markStepCompleted({
        tenantId,
        companyId,
        stepType: SetupStepType.POC,
        completedBy: userId,
        entityManager: manager,
      });

      // 7. Write outbox event for scheduling
      const outboxRepo = manager.getRepository(OutboxEventEntity);
      const scheduledEvent = outboxRepo.create({
        aggregateType: AggregateType.POC,
        aggregateId: poc.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: poc.id,
          entityType: 'poc',
          operation: 'CREATE',
          effectiveAt: poc.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        executionTime: poc.effectiveAt,
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(scheduledEvent);

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
    authContext?: AuthContext | null,
  ): Promise<EffectiveChangeEntity> {
    const userId = authContext?.userId;
    const tenantId = this.resolveTenantId(authContext);

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(
      tenantId,
      companyId,
      dto.effectiveAt,
    );

    // 2. Verify target PoC is active (or scheduled)
    const poc = await this.verifyPocExists(tenantId, companyId, pocId);
    if (poc.status === MasterDataStatus.INACTIVE) {
      throw new BadRequestException(`Cannot schedule replacement for an INACTIVE Point of Contact`);
    }

    // 3. Verify new employee exists in projection
    await this.verifyEmployeeReference(tenantId, companyId, dto.newEmployeeId);

    // 4. Verify no pending change exists for this PoC (BR-13)
    await this.verifyNoPendingChange(companyId, pocId, 'scheduling replacement');

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      const savedChange = await this.effectiveChangeRepository.createAndSave(
        {
          tenantId,
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
        },
        manager,
      );

      // Write outbox event
      const outboxRepo = manager.getRepository(OutboxEventEntity);
      const scheduledEvent = outboxRepo.create({
        aggregateType: AggregateType.EFFECTIVE_CHANGE,
        aggregateId: savedChange.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: savedChange.id,
          entityType: 'poc',
          operation: 'UPDATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        executionTime: savedChange.effectiveAt,
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(scheduledEvent);

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
    authContext?: AuthContext | null,
  ): Promise<EffectiveChangeEntity> {
    const userId = authContext?.userId;
    const tenantId = this.resolveTenantId(authContext);

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(
      tenantId,
      companyId,
      dto.effectiveAt,
    );

    // 2. Verify target PoC exists and is active
    const poc = await this.verifyPocExists(tenantId, companyId, pocId);
    if (poc.status === MasterDataStatus.INACTIVE) {
      throw new BadRequestException(`Point of Contact is already INACTIVE`);
    }

    // 3. Verify no pending change exists (BR-13)
    await this.verifyNoPendingChange(companyId, pocId, 'scheduling deactivation');

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      const savedChange = await this.effectiveChangeRepository.createAndSave(
        {
          tenantId,
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
        },
        manager,
      );

      // Write outbox event
      const outboxRepo = manager.getRepository(OutboxEventEntity);
      const scheduledEvent = outboxRepo.create({
        aggregateType: AggregateType.EFFECTIVE_CHANGE,
        aggregateId: savedChange.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: savedChange.id,
          entityType: 'poc',
          operation: 'DEACTIVATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        executionTime: savedChange.effectiveAt,
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(scheduledEvent);

      this.logger.log(
        `Scheduled deactivation for PoC ${poc.pocType} (${pocId}) in company ${companyId}`,
      );

      return savedChange;
    });
  }

  private resolveTenantId(authContext?: AuthContext | null): string {
    const tenantId = authContext?.tenantCode || RequestContextService.getTenantCode();
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required but could not be resolved from context');
    }
    return tenantId;
  }

  private async validateEffectiveDate(
    tenantId: string,
    companyId: string,
    effectiveAt: string,
  ): Promise<{ effectiveAtDate: Date; timezone: string }> {
    const company = await this.companyRepository.findByIdAndTenant(companyId, tenantId);
    if (!company) {
      throw new NotFoundException(`Company '${companyId}' not found for tenant '${tenantId}'`);
    }

    const tz = company.timezone || 'UTC';
    const validation = EffectiveDateUtil.validateFutureEffectiveDate(effectiveAt, tz);
    if (!validation.isValid) {
      throw new BadRequestException(
        `Effective date must be strictly in the future (on or after end of current business day in ${tz})`,
      );
    }

    return {
      effectiveAtDate: new Date(effectiveAt),
      timezone: tz,
    };
  }

  private async verifyEmployeeReference(
    tenantId: string,
    companyId: string,
    employeeId: string,
  ): Promise<void> {
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

  private async verifyPocExists(
    tenantId: string,
    companyId: string,
    pocId: string,
  ): Promise<PocEntity> {
    const poc = await this.pocRepository.findById(tenantId, companyId, pocId);
    if (!poc) {
      throw new NotFoundException(
        `Point of Contact '${pocId}' not found for company '${companyId}'`,
      );
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
