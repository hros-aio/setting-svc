import { Injectable, Logger } from '@nestjs/common';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource } from 'typeorm';
import {
  AggregateType,
  ChangeOperation,
  EffectiveChangeEventType,
  EffectiveEntityType,
  OutboxStatus,
} from '../../../enums';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { EffectiveScheduledCommand } from '../dto/effective-scheduled-event.dto';
import { DepartmentApplyHandler } from '../handlers/department-apply.handler';
import { EmployeeTransferApplyHandler } from '../handlers/employee-transfer-apply.handler';
import { GradeApplyHandler } from '../handlers/grade-apply.handler';
import { JobTitleApplyHandler } from '../handlers/job-title-apply.handler';
import { EffectiveExecuteCommand, LocationApplyHandler } from '../handlers/location-apply.handler';
import { PocApplyHandler } from '../handlers/poc-apply.handler';

@Injectable()
export class EffectiveChangeService {
  private readonly logger = new Logger(EffectiveChangeService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionService: TransactionService,
    private readonly locationApplyHandler: LocationApplyHandler,
    private readonly departmentApplyHandler: DepartmentApplyHandler,
    private readonly gradeApplyHandler: GradeApplyHandler,
    private readonly jobTitleApplyHandler: JobTitleApplyHandler,
    private readonly pocApplyHandler: PocApplyHandler,
    private readonly employeeTransferApplyHandler: EmployeeTransferApplyHandler,
  ) {}

  private mapAggregateType(entityType: string): AggregateType | string {
    const lower = entityType?.toLowerCase();
    switch (lower) {
      case EffectiveEntityType.LOCATION:
        return AggregateType.LOCATION;
      case EffectiveEntityType.DEPARTMENT:
        return AggregateType.DEPARTMENT;
      case EffectiveEntityType.GRADE:
        return AggregateType.GRADE;
      case EffectiveEntityType.JOB_TITLE:
      case EffectiveEntityType.JOBTITLE:
        return AggregateType.JOB_TITLE;
      case EffectiveEntityType.POC:
        return AggregateType.POC;
      case EffectiveEntityType.EMPLOYEE_TRANSFER:
        return AggregateType.EMPLOYEE_TRANSFER;
      default:
        return AggregateType.EFFECTIVE_CHANGE;
    }
  }

  private normalizeEntityType(entityType: string): EffectiveEntityType | string {
    const lower = entityType?.toLowerCase();
    switch (lower) {
      case 'location':
        return EffectiveEntityType.LOCATION;
      case 'department':
        return EffectiveEntityType.DEPARTMENT;
      case 'grade':
        return EffectiveEntityType.GRADE;
      case 'job_title':
        return EffectiveEntityType.JOB_TITLE;
      case 'poc':
        return EffectiveEntityType.POC;
      case 'employee_transfer':
        return EffectiveEntityType.EMPLOYEE_TRANSFER;
      default:
        return entityType;
    }
  }

  private normalizeOperation(operation: string): ChangeOperation | string {
    const lower = operation?.toLowerCase();
    switch (lower) {
      case 'create':
        return ChangeOperation.CREATE;
      case 'update':
        return ChangeOperation.UPDATE;
      case 'deactivate':
        return ChangeOperation.DEACTIVATE;
      default:
        return operation;
    }
  }

  async scheduleExecution(command: EffectiveScheduledCommand): Promise<void> {
    const effectiveAtDate = new Date(command.effectiveAt);
    const now = new Date();

    if (effectiveAtDate.getTime() > now.getTime()) {
      this.logger.log(
        `Skipping scheduleExecution for change ${command.changeId}: effectiveAt (${effectiveAtDate.toISOString()}) is in the future compared to current time (${now.toISOString()})`,
      );
      return;
    }

    const normalizedEntityType = this.normalizeEntityType(command.entityType);
    const normalizedOperation = this.normalizeOperation(command.operation);

    this.logger.log(
      `Scheduling execution for effective change: ${command.changeId} (Entity: ${normalizedEntityType}, Op: ${normalizedOperation})`,
    );

    return this.transactionService.runInTransaction(async () => {
      const em = this.dataSource.manager;
      const outboxRepo = em.getRepository(OutboxEventEntity);

      const aggregateType = this.mapAggregateType(command.entityType);

      const outboxEvent = outboxRepo.create({
        aggregateType,
        aggregateId: command.changeId,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_EXECUTE,
        payload: {
          changeId: command.changeId,
          entityType: normalizedEntityType,
          operation: normalizedOperation,
          effectiveAt: command.effectiveAt,
          targetCompanyId: command.targetCompanyId,
          tenantId: command.tenantId,
          parameters: command.parameters || {},
        },
        executionTime: new Date(),
        status: OutboxStatus.PENDING,
      });

      await outboxRepo.save(outboxEvent);
      this.logger.log(
        `Created outbox event ${EffectiveChangeEventType.EFFECTIVE_CHANGE_EXECUTE} for change ${command.changeId}`,
      );
    });
  }

  async executeChange(command: EffectiveExecuteCommand): Promise<void> {
    this.logger.log(
      `Executing effective change: ${command.changeId} (Entity: ${command.entityType}, Op: ${command.operation})`,
    );

    return this.transactionService.runInTransaction(async () => {
      const em = this.dataSource.manager;

      const entityType = command.entityType.toLowerCase();
      switch (entityType) {
        case EffectiveEntityType.LOCATION:
          await this.locationApplyHandler.apply(command, em);
          break;
        case EffectiveEntityType.DEPARTMENT:
          await this.departmentApplyHandler.apply(command, em);
          break;
        case EffectiveEntityType.GRADE:
          await this.gradeApplyHandler.apply(command, em);
          break;
        case EffectiveEntityType.JOB_TITLE:
        case EffectiveEntityType.JOBTITLE:
          await this.jobTitleApplyHandler.apply(command, em);
          break;
        case EffectiveEntityType.POC:
          await this.pocApplyHandler.apply(command, em);
          break;
        case EffectiveEntityType.EMPLOYEE_TRANSFER:
          await this.employeeTransferApplyHandler.apply(command, em);
          break;
        default:
          this.logger.warn(`Handler for entity type '${command.entityType}' not yet registered`);
          break;
      }
    });
  }
}
