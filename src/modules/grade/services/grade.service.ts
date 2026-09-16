import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { Grade, TransactionService } from '@new-hros/libs-sql';
import { EffectiveDateUtil } from '../../../common/utils/effective-date.util';
import {
  AggregateType,
  ChangeOperation,
  EffectiveChangeEventType,
  EffectiveChangeStatus,
  MasterDataStatus,
  OutboxStatus,
  SetupStepType,
} from '../../../enums';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { OutboxEventRepository } from '../../company/repositories/outbox-event.repository';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { CreateGradeDto } from '../dtos/create-grade.dto';
import { DeactivateGradeDto } from '../dtos/query-grade.dto';
import { UpdateGradeDto } from '../dtos/update-grade.dto';
import { GradeRepository } from '../repositories/grade.repository';

@Injectable()
export class GradeService {
  private readonly logger = new Logger(GradeService.name);

  constructor(
    private readonly transactionService: TransactionService,
    private readonly gradeRepository: GradeRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly companySetupStepRepository: CompanySetupStepRepository,
    private readonly effectiveChangeRepository: EffectiveChangeRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  async create(dto: CreateGradeDto, companyId: string): Promise<Grade> {
    const userId = RequestContextService.getUser().userId;
    const tenantCode = RequestContextService.getTenantCode();

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(companyId, dto.effectiveAt);

    // 2. Validate uniqueness of grade code within company
    const existingGrade = await this.gradeRepository.findByCode(companyId, dto.code);
    if (existingGrade) {
      throw new ConflictException(`Grade code '${dto.code}' already exists in this company`);
    }

    return this.transactionService.runInTransaction(async () => {
      // 3. Persist Grade in scheduled status
      const grade = await this.gradeRepository.create({
        code: dto.code,
        name: dto.name,
        description: dto.description,
        rankOrder: dto.rankOrder,
        status: MasterDataStatus.SCHEDULED,
        effectiveAt: effectiveAtDate,
        createdBy: userId,
        updatedBy: userId,
      });

      // 4. Complete GRADE setup step (Step 4)
      await this.companySetupStepRepository.markStepCompleted({
        companyId,
        stepType: SetupStepType.GRADE,
        completedBy: userId,
      });

      // 5. Write outbox event for scheduling
      await this.outboxEventRepository.create({
        aggregateType: AggregateType.GRADE,
        aggregateId: grade.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: grade.id,
          entityType: 'grade',
          operation: 'CREATE',
          effectiveAt: grade.effectiveAt,
          targetCompanyId: companyId,
          tenantCode,
        },
        executionTime: grade.effectiveAt,
        status: OutboxStatus.PENDING,
      });

      return grade;
    });
  }

  async scheduleUpdate(
    id: string,
    dto: UpdateGradeDto,
    companyId: string,
  ): Promise<EffectiveChangeEntity> {
    const userId = RequestContextService.getUser().userId;
    const tenantCode = RequestContextService.getTenantCode();

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(companyId, dto.effectiveAt);

    // 2. Verify target grade is active
    const grade = await this.verifyActiveGrade(id, 'updates');

    // 3. Verify no pending change exists for this grade
    await this.verifyNoPendingChange(companyId, id, 'scheduling a new update');

    // 4. Code uniqueness check if updating code
    if (dto.code && dto.code !== grade.code) {
      const existing = await this.gradeRepository.findByCode(companyId, dto.code);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Grade code '${dto.code}' already exists in this company`);
      }
    }

    // 5. Build payload
    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.code !== undefined) updatePayload.code = dto.code;
    if (dto.description !== undefined) updatePayload.description = dto.description;
    if (dto.rankOrder !== undefined) updatePayload.rankOrder = dto.rankOrder;

    return this.transactionService.runInTransaction(async () => {
      const savedChange = await this.effectiveChangeRepository.create({
        tenantCode,
        companyId,
        entityType: 'grade',
        entityId: id,
        operation: ChangeOperation.UPDATE,
        payload: updatePayload,
        status: EffectiveChangeStatus.SCHEDULED,
        effectiveAt: effectiveAtDate,
        createdBy: userId,
      });

      // Write outbox event
      await this.outboxEventRepository.create({
        aggregateType: AggregateType.EFFECTIVE_CHANGE,
        aggregateId: savedChange.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: savedChange.id,
          entityType: 'grade',
          operation: 'UPDATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantCode,
        },
        executionTime: savedChange.effectiveAt,
        status: OutboxStatus.PENDING,
      });

      return savedChange;
    });
  }

  async scheduleDeactivation(
    id: string,
    dto: DeactivateGradeDto,
    companyId: string,
  ): Promise<EffectiveChangeEntity> {
    const userId = RequestContextService.getUser().userId;
    const tenantCode = RequestContextService.getTenantCode();

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(companyId, dto.effectiveAt);

    // 2. Verify target grade is active
    const grade = await this.verifyActiveGrade(id, 'deactivation');

    // 3. Verify no pending change exists for this grade
    await this.verifyNoPendingChange(companyId, id, 'scheduling deactivation');

    return this.transactionService.runInTransaction(async () => {
      const savedChange = await this.effectiveChangeRepository.create({
        tenantCode,
        companyId,
        entityType: 'grade',
        entityId: grade.id,
        operation: ChangeOperation.DEACTIVATE,
        payload: { status: MasterDataStatus.INACTIVE },
        status: EffectiveChangeStatus.SCHEDULED,
        effectiveAt: effectiveAtDate,
        createdBy: userId,
      });

      // Write outbox event
      await this.outboxEventRepository.create({
        aggregateType: AggregateType.EFFECTIVE_CHANGE,
        aggregateId: savedChange.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: savedChange.id,
          entityType: 'grade',
          operation: 'DEACTIVATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantCode,
        },
        executionTime: savedChange.effectiveAt,
        status: OutboxStatus.PENDING,
      });

      return savedChange;
    });
  }

  // --- Common Verification Helpers ---
  private async validateEffectiveDate(
    companyId: string,
    effectiveAt: string,
  ): Promise<{ effectiveAtDate: Date; companyTimezone?: string }> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new NotFoundException(`Target company with ID '${companyId}' not found`);
    }

    const effectiveAtDate = new Date(effectiveAt);
    if (isNaN(effectiveAtDate.getTime())) {
      throw new BadRequestException('Invalid effectiveAt date format');
    }

    const { isValid, cutoff } = EffectiveDateUtil.validateFutureEffectiveDate(
      effectiveAtDate,
      company.timezone,
    );
    if (!isValid) {
      throw new BadRequestException(
        `effectiveAt must be scheduled on or after the end of the current business day (${cutoff.toISOString()}) in company timezone (${company.timezone || 'UTC'})`,
      );
    }

    return { effectiveAtDate, companyTimezone: company.timezone };
  }

  private async verifyActiveGrade(
    gradeId: string,
    action: 'updates' | 'deactivation' = 'updates',
  ): Promise<Grade> {
    const grade = await this.gradeRepository.findById(gradeId);
    if (!grade) {
      throw new NotFoundException(`Grade with ID '${gradeId}' not found`);
    }
    if (grade.status !== MasterDataStatus.ACTIVE) {
      throw new BadRequestException(
        action === 'deactivation'
          ? 'Only active grades can be deactivated'
          : 'Only active grades can have updates scheduled',
      );
    }
    return grade;
  }

  private async verifyNoPendingChange(
    companyId: string,
    gradeId: string,
    action: string = 'scheduling a new update',
  ): Promise<void> {
    const existingPending = await this.effectiveChangeRepository.findPendingChange(
      companyId,
      'grade',
      gradeId,
    );
    if (existingPending) {
      throw new ConflictException(
        `A pending change is already scheduled for this grade. Cancel it before ${action}.`,
      );
    }
  }
}
