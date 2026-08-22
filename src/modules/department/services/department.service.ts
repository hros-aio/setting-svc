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
import { CreateDepartmentDto } from '../dtos/create-department.dto';
import { DeactivateDepartmentDto, QueryDepartmentDto } from '../dtos/query-department.dto';
import { UpdateDepartmentDto } from '../dtos/update-department.dto';
import { Department } from '@new-hros/libs-sql';
import { DepartmentRepository } from '../repositories/department.repository';
import {
  DepartmentTreeNode,
  PaginatedResult,
} from '../repositories/department.repository.interface';

@Injectable()
export class DepartmentService {
  private readonly logger = new Logger(DepartmentService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionService: TransactionService,
    private readonly departmentRepository: DepartmentRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly companySetupStepRepository: CompanySetupStepRepository,
    private readonly effectiveChangeRepository: EffectiveChangeRepository,
  ) {}

  async create(dto: CreateDepartmentDto, authContext?: AuthContext | null): Promise<Department> {
    const userId = authContext?.userId;
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate } = await this.validateEffectiveDate(
      tenantId,
      companyId,
      dto.effectiveAt,
    );

    // 2. Validate uniqueness of department code within company
    const existingDept = await this.departmentRepository.findByCode(tenantId, companyId, dto.code);
    if (existingDept) {
      throw new ConflictException(`Department code '${dto.code}' already exists in this company`);
    }

    // 3. Validate parent department if provided
    if (dto.parentDepartmentId) {
      await this.verifyParentDepartment(tenantId, companyId, dto.parentDepartmentId);
    }

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      // 4. Persist Department in scheduled status
      const department = await this.departmentRepository.createAndSave(
        {
          tenantId,
          companyId,
          code: dto.code,
          name: dto.name,
          description: dto.description,
          parentDepartmentId: dto.parentDepartmentId,
          status: MasterDataStatus.SCHEDULED,
          effectiveAt: effectiveAtDate,
          createdBy: userId,
          updatedBy: userId,
        },
        manager,
      );

      // 5. Complete DEPARTMENT setup step if needed
      await this.companySetupStepRepository.markStepCompleted({
        tenantId,
        companyId,
        stepType: SetupStepType.DEPARTMENT,
        completedBy: userId,
        entityManager: manager,
      });

      // 6. Write outbox event for scheduling
      const outboxRepo = manager.getRepository(OutboxEventEntity);
      const scheduledEvent = outboxRepo.create({
        aggregateType: AggregateType.DEPARTMENT,
        aggregateId: department.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: department.id,
          entityType: 'department',
          operation: 'CREATE',
          effectiveAt: department.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        executionTime: department.effectiveAt,
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(scheduledEvent);

      return department;
    });
  }

  async findActiveDepartments(
    query?: QueryDepartmentDto,
    authContext?: AuthContext | null,
  ): Promise<PaginatedResult<Department> | DepartmentTreeNode[]> {
    const tenantId = authContext?.tenantCode || RequestContextService.getTenantCode();
    const companyId = RequestContextService.current()?.companyId;

    const page = query?.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query?.limit && query.limit > 0 ? Math.min(Number(query.limit), 100) : 20;

    if (!tenantId || !companyId) {
      this.logger.warn(
        `Cannot find active departments: missing ${!tenantId ? 'tenantId' : 'companyId'} from request context`,
      );
      if (query?.asTree) {
        return [];
      }
      return {
        data: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }

    if (query?.asTree) {
      return this.departmentRepository.findActiveDepartmentTree(tenantId, companyId);
    }

    return this.departmentRepository.findActiveDepartments(tenantId, companyId, {
      page,
      limit,
      search: query?.search,
    });
  }

  async findById(id: string, authContext?: AuthContext | null): Promise<Department> {
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);
    const department = await this.departmentRepository.findById(tenantId, companyId, id);
    if (!department) {
      throw new NotFoundException(`Department with ID '${id}' not found`);
    }
    return department;
  }

  async scheduleUpdate(
    id: string,
    dto: UpdateDepartmentDto,
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

    // 2. Verify target department is active
    const department = await this.verifyActiveDepartment(tenantId, companyId, id, 'updates');

    // 3. Verify no pending change exists for this department
    await this.verifyNoPendingChange(companyId, id, 'scheduling a new update');

    // 4. Code uniqueness check if updating code
    if (dto.code && dto.code !== department.code) {
      const existing = await this.departmentRepository.findByCode(tenantId, companyId, dto.code);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Department code '${dto.code}' already exists in this company`);
      }
    }

    // 5. Parent department validation & anti-cycle check
    if (dto.parentDepartmentId !== undefined) {
      if (dto.parentDepartmentId === id) {
        throw new BadRequestException('Department cannot be its own parent');
      }

      if (dto.parentDepartmentId !== null) {
        await this.verifyParentDepartment(tenantId, companyId, dto.parentDepartmentId);

        // Walk ancestor chain to prevent circular loop
        const ancestors = await this.departmentRepository.findAncestorChain(
          tenantId,
          companyId,
          dto.parentDepartmentId,
          50,
        );
        if (ancestors.includes(id)) {
          throw new ConflictException(
            'Circular hierarchy detected: setting this parent creates a cycle in department structure',
          );
        }
      }
    }

    // 6. Build payload
    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.code !== undefined) updatePayload.code = dto.code;
    if (dto.description !== undefined) updatePayload.description = dto.description;
    if (dto.parentDepartmentId !== undefined) {
      updatePayload.parentDepartmentId = dto.parentDepartmentId;
    }

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      const savedChange = await this.effectiveChangeRepository.createAndSave(
        {
          tenantId,
          companyId,
          entityType: 'department',
          entityId: department.id,
          operation: ChangeOperation.UPDATE,
          payload: updatePayload,
          status: EffectiveChangeStatus.SCHEDULED,
          effectiveAt: effectiveAtDate,
          expectedUpdatedAt: department.updatedAt,
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
          entityType: 'department',
          operation: 'UPDATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        executionTime: savedChange.effectiveAt,
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(scheduledEvent);

      return savedChange;
    });
  }

  async scheduleDeactivation(
    id: string,
    dto: DeactivateDepartmentDto,
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

    // 2. Verify target department is active
    const department = await this.verifyActiveDepartment(tenantId, companyId, id, 'deactivation');

    // 3. Verify no pending change exists for this department
    await this.verifyNoPendingChange(companyId, id, 'scheduling deactivation');

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      const savedChange = await this.effectiveChangeRepository.createAndSave(
        {
          tenantId,
          companyId,
          entityType: 'department',
          entityId: department.id,
          operation: ChangeOperation.DEACTIVATE,
          payload: {},
          status: EffectiveChangeStatus.SCHEDULED,
          effectiveAt: effectiveAtDate,
          expectedUpdatedAt: department.updatedAt,
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
          entityType: 'department',
          operation: 'DEACTIVATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        executionTime: savedChange.effectiveAt,
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

  private async verifyActiveDepartment(
    tenantId: string,
    companyId: string,
    departmentId: string,
    action: 'updates' | 'deactivation' = 'updates',
  ): Promise<Department> {
    const department = await this.departmentRepository.findById(tenantId, companyId, departmentId);
    if (!department) {
      throw new NotFoundException(`Department with ID '${departmentId}' not found`);
    }
    if (department.status !== MasterDataStatus.ACTIVE) {
      throw new BadRequestException(
        action === 'deactivation'
          ? 'Only active departments can be deactivated'
          : 'Only active departments can have updates scheduled',
      );
    }
    return department;
  }

  private async verifyParentDepartment(
    tenantId: string,
    companyId: string,
    parentDepartmentId: string,
  ): Promise<Department> {
    const parent = await this.departmentRepository.findById(
      tenantId,
      companyId,
      parentDepartmentId,
    );
    if (!parent) {
      throw new NotFoundException(
        `Parent department with ID '${parentDepartmentId}' not found in this company`,
      );
    }
    if (parent.status !== MasterDataStatus.ACTIVE) {
      throw new BadRequestException('Parent department must be in active status');
    }
    return parent;
  }

  private async verifyNoPendingChange(
    companyId: string,
    departmentId: string,
    action: string = 'scheduling a new update',
  ): Promise<void> {
    const existingPending = await this.effectiveChangeRepository.findPendingChange(
      companyId,
      'department',
      departmentId,
    );
    if (existingPending) {
      throw new ConflictException(
        `A pending change is already scheduled for this department. Cancel it before ${action}.`,
      );
    }
  }
}
