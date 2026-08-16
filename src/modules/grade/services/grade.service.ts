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
  SetupStepType,
} from '../../../enums';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { CreateGradeDto } from '../dtos/create-grade.dto';
import { DeactivateGradeDto } from '../dtos/query-grade.dto';
import { UpdateGradeDto } from '../dtos/update-grade.dto';
import { GradeEntity } from '../entities/grade.entity';
import { GradeRepository } from '../repositories/grade.repository';

@Injectable()
export class GradeService {
  private readonly logger = new Logger(GradeService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionService: TransactionService,
    private readonly gradeRepository: GradeRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly companySetupStepRepository: CompanySetupStepRepository,
    private readonly effectiveChangeRepository: EffectiveChangeRepository,
  ) {}

  async create(dto: CreateGradeDto, authContext?: AuthContext | null): Promise<GradeEntity> {
    const userId = authContext?.userId;
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(
      tenantId,
      companyId,
      dto.effectiveAt,
    );

    // 2. Validate uniqueness of grade code within company
    const existingGrade = await this.gradeRepository.findByCode(tenantId, companyId, dto.code);
    if (existingGrade) {
      throw new ConflictException(`Grade code '${dto.code}' already exists in this company`);
    }

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      // 3. Persist Grade in scheduled status
      const grade = await this.gradeRepository.createAndSave(
        {
          tenantId,
          companyId,
          code: dto.code,
          name: dto.name,
          description: dto.description,
          rankOrder: dto.rankOrder,
          status: MasterDataStatus.SCHEDULED,
          effectiveAt: effectiveAtDate,
          createdBy: userId,
          updatedBy: userId,
        },
        manager,
      );

      // 4. Complete GRADE setup step (Step 4)
      await this.companySetupStepRepository.markStepCompleted(
        tenantId,
        companyId,
        SetupStepType.GRADE,
        userId,
        manager,
      );

      // 5. Write outbox event for scheduling
      const outboxRepo = manager.getRepository(OutboxEventEntity);
      const scheduledEvent = outboxRepo.create({
        aggregateType: AggregateType.GRADE,
        aggregateId: grade.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: grade.id,
          entityType: 'grade',
          operation: 'CREATE',
          effectiveAt: grade.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(scheduledEvent);

      return grade;
    });
  }

  async scheduleUpdate(
    id: string,
    dto: UpdateGradeDto,
    authContext?: AuthContext | null,
  ): Promise<EffectiveChangeEntity> {
    const userId = authContext?.userId;
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(
      tenantId,
      companyId,
      dto.effectiveAt,
    );

    // 2. Verify target grade is active
    const grade = await this.verifyActiveGrade(tenantId, companyId, id, 'updates');

    // 3. Verify no pending change exists for this grade
    await this.verifyNoPendingChange(companyId, id, 'scheduling a new update');

    // 4. Code uniqueness check if updating code
    if (dto.code && dto.code !== grade.code) {
      const existing = await this.gradeRepository.findByCode(tenantId, companyId, dto.code);
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
      const manager = this.dataSource.manager;

      const savedChange = await this.effectiveChangeRepository.createAndSave(
        {
          tenantId,
          companyId,
          entityType: 'grade',
          entityId: grade.id,
          operation: ChangeOperation.UPDATE,
          payload: updatePayload,
          status: EffectiveChangeStatus.SCHEDULED,
          effectiveAt: effectiveAtDate,
          expectedUpdatedAt: grade.updatedAt,
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
          entityType: 'grade',
          operation: 'UPDATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(scheduledEvent);

      return savedChange;
    });
  }

  async scheduleDeactivation(
    id: string,
    dto: DeactivateGradeDto,
    authContext?: AuthContext | null,
  ): Promise<EffectiveChangeEntity> {
    const userId = authContext?.userId;
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(
      tenantId,
      companyId,
      dto.effectiveAt,
    );

    // 2. Verify target grade is active
    const grade = await this.verifyActiveGrade(tenantId, companyId, id, 'deactivation');

    // 3. Verify no pending change exists for this grade
    await this.verifyNoPendingChange(companyId, id, 'scheduling deactivation');

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      const savedChange = await this.effectiveChangeRepository.createAndSave(
        {
          tenantId,
          companyId,
          entityType: 'grade',
          entityId: grade.id,
          operation: ChangeOperation.DEACTIVATE,
          payload: {},
          status: EffectiveChangeStatus.SCHEDULED,
          effectiveAt: effectiveAtDate,
          expectedUpdatedAt: grade.updatedAt,
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
          entityType: 'grade',
          operation: 'DEACTIVATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(scheduledEvent);

      return savedChange;
    });
  }

  // --- Common Verification Helpers ---

  private resolveTenantAndCompany(authContext?: AuthContext | null): {
    tenantId: string;
    companyId: string;
  } {
    const tenantId = authContext?.tenantCode || RequestContextService.getTenantCode();
    const companyId = RequestContextService.current()?.companyId;

    if (!tenantId) {
      throw new BadRequestException('Cannot determine tenant from request context');
    }
    if (!companyId) {
      throw new BadRequestException('Cannot determine company from request context');
    }

    return { tenantId, companyId };
  }

  private async validateEffectiveDate(
    tenantId: string,
    companyId: string,
    effectiveAt: string,
  ): Promise<{ effectiveAtDate: Date; companyTimezone?: string }> {
    const company = await this.companyRepository.findByIdAndTenant(companyId, tenantId);
    if (!company) {
      throw new NotFoundException(`Company with ID '${companyId}' not found`);
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
    tenantId: string,
    companyId: string,
    gradeId: string,
    action: 'updates' | 'deactivation' = 'updates',
  ): Promise<GradeEntity> {
    const grade = await this.gradeRepository.findById(tenantId, companyId, gradeId);
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
