import { Injectable } from '@nestjs/common';
import { OutboxEventEntity, OutboxStatus } from '@new-hros/libs-sql';
import { DeepPartial } from 'typeorm';
import {
  AggregateType,
  CompanyEventType,
  CompanyStatus,
  EffectiveChangeEventType,
} from '../../../enums';
import { OutboxEventRepository } from '../repositories/outbox-event.repository';

export interface EffectiveScheduledParams {
  changeId: string;
  entityType: string;
  operation: string;
  effectiveAt: Date | string;
  targetCompanyId: string;
  tenantCode: string;
  entityId?: string;
}

export interface EmployeeTransferScheduledParams {
  tenantCode: string;
  employeeId: string;
  sourceCompanyId: string;
  destinationCompanyId: string;
  destinationLocationId?: string;
  destinationDepartmentId?: string;
  destinationGradeId?: string;
  destinationJobTitleId?: string;
}

export interface CompanyUpdateOutboxParams {
  companyId: string;
  tenantCode: string;
  companyCode?: string;
  legalName?: string | null;
  displayName?: string | null;
  status: string;
  countryCode?: string | null;
  currencyCode?: string | null;
  timezone?: string | null;
  informationCompleted: boolean;
  informationCompletedAt: Date;
  informationCompletedBy: string;
  updatedAt: Date;
}

@Injectable()
export class OutboxEventService {
  constructor(private readonly outboxEventRepository: OutboxEventRepository) {}

  async create(entityData: DeepPartial<OutboxEventEntity>): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create(entityData);
  }

  // --- Location ---

  async fromLocationCreated(
    location: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.LOCATION,
      aggregateId: location.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: location.id,
        entityType: 'location',
        operation: 'CREATE',
        effectiveAt: location.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  async fromLocationUpdated(
    change: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.EFFECTIVE_CHANGE,
      aggregateId: change.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: change.id,
        entityType: 'location',
        operation: 'UPDATE',
        effectiveAt: change.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  async fromLocationDeactivated(
    change: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.EFFECTIVE_CHANGE,
      aggregateId: change.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: change.id,
        entityType: 'location',
        operation: 'DEACTIVATE',
        effectiveAt: change.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  // --- Department ---

  async fromDepartmentCreated(
    department: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.DEPARTMENT,
      aggregateId: department.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: department.id,
        entityType: 'department',
        operation: 'CREATE',
        effectiveAt: department.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  async fromDepartmentUpdated(
    change: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
    entityId?: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.EFFECTIVE_CHANGE,
      aggregateId: change.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: change.id,
        entityType: 'department',
        entityId,
        operation: 'UPDATE',
        effectiveAt: change.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  async fromDepartmentDeactivated(
    change: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
    entityId?: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.EFFECTIVE_CHANGE,
      aggregateId: change.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: change.id,
        entityType: 'department',
        entityId,
        operation: 'DEACTIVATE',
        effectiveAt: change.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  // --- Grade ---

  async fromGradeCreated(
    grade: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
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
      status: OutboxStatus.PENDING,
    });
  }

  async fromGradeUpdated(
    change: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.EFFECTIVE_CHANGE,
      aggregateId: change.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: change.id,
        entityType: 'grade',
        operation: 'UPDATE',
        effectiveAt: change.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  async fromGradeDeactivated(
    change: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.EFFECTIVE_CHANGE,
      aggregateId: change.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: change.id,
        entityType: 'grade',
        operation: 'DEACTIVATE',
        effectiveAt: change.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  // --- Job Title ---

  async fromJobTitleCreated(
    jobTitle: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.JOB_TITLE,
      aggregateId: jobTitle.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: jobTitle.id,
        entityType: 'job_title',
        operation: 'CREATE',
        effectiveAt: jobTitle.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  async fromJobTitleUpdated(
    change: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.EFFECTIVE_CHANGE,
      aggregateId: change.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: change.id,
        entityType: 'job_title',
        operation: 'UPDATE',
        effectiveAt: change.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  async fromJobTitleDeactivated(
    change: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.EFFECTIVE_CHANGE,
      aggregateId: change.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: change.id,
        entityType: 'job_title',
        operation: 'DEACTIVATE',
        effectiveAt: change.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  // --- Point of Contact (PoC) ---

  async fromPocCreated(
    poc: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
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
      status: OutboxStatus.PENDING,
    });
  }

  async fromPocUpdated(
    change: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.EFFECTIVE_CHANGE,
      aggregateId: change.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: change.id,
        entityType: 'poc',
        operation: 'UPDATE',
        effectiveAt: change.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  async fromPocDeactivated(
    change: { id: string; effectiveAt: Date },
    companyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.EFFECTIVE_CHANGE,
      aggregateId: change.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        changeId: change.id,
        entityType: 'poc',
        operation: 'DEACTIVATE',
        effectiveAt: change.effectiveAt,
        targetCompanyId: companyId,
        tenantCode,
      },
      status: OutboxStatus.PENDING,
    });
  }

  // --- Employee Transfer ---

  async fromEmployeeTransferScheduled(
    transfer: { id: string; effectiveAt: Date },
    params: EmployeeTransferScheduledParams,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.EMPLOYEE_TRANSFER,
      aggregateId: transfer.id,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      payload: {
        transferId: transfer.id,
        changeType: 'EMPLOYEE_TRANSFER',
        tenantCode: params.tenantCode,
        employeeId: params.employeeId,
        sourceCompanyId: params.sourceCompanyId,
        destinationCompanyId: params.destinationCompanyId,
        destinationLocationId: params.destinationLocationId,
        destinationDepartmentId: params.destinationDepartmentId,
        destinationGradeId: params.destinationGradeId,
        destinationJobTitleId: params.destinationJobTitleId,
        effectiveAt: transfer.effectiveAt,
      },
      status: OutboxStatus.PENDING,
    });
  }

  // --- Company ---

  async fromCompanyProvisioned(
    company: {
      id: string;
      tenantCode: string;
      companyCode: string;
      legalName?: string | null;
      status: string;
      isTemplate?: boolean;
    },
    tenantId: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.COMPANY,
      aggregateId: company.id,
      eventType: CompanyEventType.COMPANY_CREATED,
      payload: {
        companyId: company.id,
        tenantId,
        tenantCode: company.tenantCode,
        companyCode: company.companyCode,
        legalName: company.legalName,
        status: company.status,
        isTemplate: company.isTemplate,
      },
      status: OutboxStatus.PENDING,
    });
  }

  async fromCompanyCreated(
    company: {
      id: string;
      tenantCode: string;
      companyCode: string;
      displayName?: string | null;
      legalName?: string | null;
      status: string;
      createdAt?: Date;
    },
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.COMPANY,
      aggregateId: company.id,
      eventType: CompanyEventType.COMPANY_CREATED,
      payload: {
        companyId: company.id,
        tenantCode,
        companyCode: company.companyCode,
        companyName: company.displayName || company.legalName,
        status: company.status,
        createdAt: company.createdAt || new Date(),
      },
      status: OutboxStatus.PENDING,
    });
  }

  async fromRoleCopyRequested(
    companyId: string,
    sourceCompanyId: string,
    tenantCode: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.COMPANY,
      aggregateId: companyId,
      eventType: CompanyEventType.ROLE_COPY_REQUESTED,
      payload: {
        tenantCode,
        sourceCompanyId,
        targetCompanyId: companyId,
      },
      status: OutboxStatus.PENDING,
    });
  }

  async fromCompanyUpdated(params: CompanyUpdateOutboxParams): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.COMPANY,
      aggregateId: params.companyId,
      eventType: CompanyEventType.COMPANY_UPDATED,
      payload: {
        companyId: params.companyId,
        tenantCode: params.tenantCode,
        companyCode: params.companyCode,
        legalName: params.legalName,
        displayName: params.displayName,
        status: params.status,
        countryCode: params.countryCode,
        currencyCode: params.currencyCode,
        timezone: params.timezone,
        informationCompleted: params.informationCompleted,
        informationCompletedAt: params.informationCompletedAt,
        informationCompletedBy: params.informationCompletedBy,
        updatedAt: params.updatedAt,
      },
      status: OutboxStatus.PENDING,
    });
  }

  async fromCompanyActivated(
    company: {
      id: string;
      companyCode: string;
      displayName?: string | null;
      legalName?: string | null;
    },
    tenantCode: string,
    userId: string,
    completedStepsCount: number,
    activatedAt: Date = new Date(),
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType: AggregateType.COMPANY,
      aggregateId: company.id,
      eventType: CompanyEventType.COMPANY_ACTIVATED,
      payload: {
        companyId: company.id,
        tenantCode,
        companyCode: company.companyCode,
        displayName: company.displayName,
        legalName: company.legalName,
        status: CompanyStatus.ACTIVE,
        activatedAt,
        activatedBy: userId,
        completedStepsCount,
      },
      status: OutboxStatus.PENDING,
    });
  }

  // --- Effective Change ---

  async fromEffectiveChangeExecute(
    command: {
      changeId: string;
      effectiveAt: Date | string;
      targetCompanyId: string;
      tenantCode: string;
      parameters?: Record<string, unknown>;
    },
    aggregateType: AggregateType | string,
    normalizedEntityType: string,
    normalizedOperation: string,
  ): Promise<OutboxEventEntity> {
    return this.outboxEventRepository.create({
      aggregateType,
      aggregateId: command.changeId,
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_EXECUTE,
      payload: {
        changeId: command.changeId,
        entityType: normalizedEntityType,
        operation: normalizedOperation,
        effectiveAt: command.effectiveAt,
        targetCompanyId: command.targetCompanyId,
        tenantCode: command.tenantCode,
        parameters: command.parameters || {},
      },
      status: OutboxStatus.PENDING,
    });
  }
}
