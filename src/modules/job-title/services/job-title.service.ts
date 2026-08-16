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
import { DepartmentRepository } from '../../department/repositories/department.repository';
import { GradeRepository } from '../../grade/repositories/grade.repository';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { CreateJobTitleDto } from '../dtos/create-job-title.dto';
import { DeactivateJobTitleDto } from '../dtos/query-job-title.dto';
import { UpdateJobTitleDto } from '../dtos/update-job-title.dto';
import { JobTitleEntity } from '../entities/job-title.entity';
import { JobTitleRepository } from '../repositories/job-title.repository';

@Injectable()
export class JobTitleService {
  private readonly logger = new Logger(JobTitleService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionService: TransactionService,
    private readonly jobTitleRepository: JobTitleRepository,
    private readonly departmentRepository: DepartmentRepository,
    private readonly gradeRepository: GradeRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly companySetupStepRepository: CompanySetupStepRepository,
    private readonly effectiveChangeRepository: EffectiveChangeRepository,
  ) {}

  async create(dto: CreateJobTitleDto, authContext?: AuthContext | null): Promise<JobTitleEntity> {
    const userId = authContext?.userId;
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(
      tenantId,
      companyId,
      dto.effectiveAt,
    );

    // 2. Validate uniqueness of job title code within company
    const existingJobTitle = await this.jobTitleRepository.findByCode(
      tenantId,
      companyId,
      dto.code,
    );
    if (existingJobTitle) {
      throw new ConflictException(`Job Title code '${dto.code}' already exists in this company`);
    }

    // 3. Validate Department belongs to the same tenant/company and is active (ADR-14, INV-006)
    await this.verifyDepartment(tenantId, companyId, dto.departmentId);

    // 4. Validate Grade belongs to the same tenant/company and is active (ADR-14, INV-006)
    await this.verifyGrade(tenantId, companyId, dto.gradeId);

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      // 5. Persist Job Title in scheduled status
      const jobTitle = await this.jobTitleRepository.createAndSave(
        {
          tenantId,
          companyId,
          code: dto.code,
          name: dto.name,
          departmentId: dto.departmentId,
          gradeId: dto.gradeId,
          description: dto.description,
          status: MasterDataStatus.SCHEDULED,
          effectiveAt: effectiveAtDate,
          createdBy: userId,
          updatedBy: userId,
        },
        manager,
      );

      // 6. Complete JOB_TITLE setup step (Step 5)
      await this.companySetupStepRepository.markStepCompleted({
        tenantId,
        companyId,
        stepType: SetupStepType.JOB_TITLE,
        completedBy: userId,
        entityManager: manager,
      });

      // 7. Write outbox event for scheduling
      const outboxRepo = manager.getRepository(OutboxEventEntity);
      const scheduledEvent = outboxRepo.create({
        aggregateType: AggregateType.JOB_TITLE,
        aggregateId: jobTitle.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: jobTitle.id,
          entityType: 'job_title',
          operation: 'CREATE',
          effectiveAt: jobTitle.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(scheduledEvent);

      return jobTitle;
    });
  }

  async scheduleUpdate(
    id: string,
    dto: UpdateJobTitleDto,
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

    // 2. Verify target job title is active
    const jobTitle = await this.verifyActiveJobTitle(tenantId, companyId, id, 'updates');

    // 3. Verify no pending change exists for this job title
    await this.verifyNoPendingChange(companyId, id, 'scheduling a new update');

    // 4. Code uniqueness check if updating code
    if (dto.code && dto.code !== jobTitle.code) {
      const existing = await this.jobTitleRepository.findByCode(tenantId, companyId, dto.code);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Job Title code '${dto.code}' already exists in this company`);
      }
    }

    // 5. If updating departmentId, validate it belongs to same company & is active
    if (dto.departmentId) {
      await this.verifyDepartment(tenantId, companyId, dto.departmentId);
    }

    // 6. If updating gradeId, validate it belongs to same company & is active
    if (dto.gradeId) {
      await this.verifyGrade(tenantId, companyId, dto.gradeId);
    }

    // 7. Build payload
    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.code !== undefined) updatePayload.code = dto.code;
    if (dto.departmentId !== undefined) updatePayload.departmentId = dto.departmentId;
    if (dto.gradeId !== undefined) updatePayload.gradeId = dto.gradeId;
    if (dto.description !== undefined) updatePayload.description = dto.description;

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      const savedChange = await this.effectiveChangeRepository.createAndSave(
        {
          tenantId,
          companyId,
          entityType: 'job_title',
          entityId: jobTitle.id,
          operation: ChangeOperation.UPDATE,
          payload: updatePayload,
          status: EffectiveChangeStatus.SCHEDULED,
          effectiveAt: effectiveAtDate,
          expectedUpdatedAt: jobTitle.updatedAt,
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
          entityType: 'job_title',
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
    dto: DeactivateJobTitleDto,
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

    // 2. Verify target job title is active
    const jobTitle = await this.verifyActiveJobTitle(tenantId, companyId, id, 'deactivation');

    // 3. Verify no pending change exists for this job title
    await this.verifyNoPendingChange(companyId, id, 'scheduling deactivation');

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      const savedChange = await this.effectiveChangeRepository.createAndSave(
        {
          tenantId,
          companyId,
          entityType: 'job_title',
          entityId: jobTitle.id,
          operation: ChangeOperation.DEACTIVATE,
          payload: {},
          status: EffectiveChangeStatus.SCHEDULED,
          effectiveAt: effectiveAtDate,
          expectedUpdatedAt: jobTitle.updatedAt,
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
          entityType: 'job_title',
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

  private async verifyDepartment(
    tenantId: string,
    companyId: string,
    departmentId: string,
  ): Promise<void> {
    const department = await this.departmentRepository.findById(tenantId, companyId, departmentId);
    if (!department) {
      throw new BadRequestException(
        `Department with ID '${departmentId}' does not exist in target company`,
      );
    }
    if (department.status !== MasterDataStatus.ACTIVE) {
      throw new BadRequestException(
        `Referenced department '${department.name}' is in '${department.status}' status and cannot be assigned`,
      );
    }
  }

  private async verifyGrade(tenantId: string, companyId: string, gradeId: string): Promise<void> {
    const grade = await this.gradeRepository.findById(tenantId, companyId, gradeId);
    if (!grade) {
      throw new BadRequestException(`Grade with ID '${gradeId}' does not exist in target company`);
    }
    if (grade.status !== MasterDataStatus.ACTIVE) {
      throw new BadRequestException(
        `Referenced grade '${grade.name}' is in '${grade.status}' status and cannot be assigned`,
      );
    }
  }

  private async verifyActiveJobTitle(
    tenantId: string,
    companyId: string,
    jobTitleId: string,
    action: 'updates' | 'deactivation' = 'updates',
  ): Promise<JobTitleEntity> {
    const jobTitle = await this.jobTitleRepository.findById(tenantId, companyId, jobTitleId);
    if (!jobTitle) {
      throw new NotFoundException(`Job Title with ID '${jobTitleId}' not found`);
    }
    if (jobTitle.status !== MasterDataStatus.ACTIVE) {
      throw new BadRequestException(
        action === 'deactivation'
          ? 'Only active job titles can be deactivated'
          : 'Only active job titles can have updates scheduled',
      );
    }
    return jobTitle;
  }

  private async verifyNoPendingChange(
    companyId: string,
    jobTitleId: string,
    action: string = 'scheduling a new update',
  ): Promise<void> {
    const existingPending = await this.effectiveChangeRepository.findPendingChange(
      companyId,
      'job_title',
      jobTitleId,
    );
    if (existingPending) {
      throw new ConflictException(
        `A pending change is already scheduled for this job title. Cancel it before ${action}.`,
      );
    }
  }
}
