import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AggregateType,
  EmployeeTransferEventType,
  EmployeeTransferStatus,
  OutboxStatus,
} from '../../../enums';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { EmployeeReferenceEntity } from '../../employee-reference/entities/employee-reference.entity';
import { EmployeeTransferEntity } from '../../employee-transfer/entities/employee-transfer.entity';
import { EffectiveExecuteCommand } from './location-apply.handler';

@Injectable()
export class EmployeeTransferApplyHandler {
  private readonly logger = new Logger(EmployeeTransferApplyHandler.name);

  constructor(private readonly dataSource: DataSource) {}

  async apply(command: EffectiveExecuteCommand, manager?: EntityManager): Promise<void> {
    const em = manager || this.dataSource.manager;
    const transferRepo = em.getRepository(EmployeeTransferEntity);

    const transfer = await transferRepo.findOne({
      where: {
        id: command.changeId,
        tenantId: command.tenantId,
      },
    });

    if (!transfer) {
      this.logger.warn(
        `Employee transfer record not found for apply execution: ${command.changeId} in tenant ${command.tenantId}`,
      );
      return;
    }

    if (transfer.status === EmployeeTransferStatus.COMPLETED) {
      this.logger.log(
        `Employee transfer ${command.changeId} is already COMPLETED. Idempotent skip.`,
      );
      return;
    }

    // 1. Transition employee active attribution in employee_references projection (continuous employment)
    const empRefRepo = em.getRepository(EmployeeReferenceEntity);
    const employeeRef = await empRefRepo.findOne({
      where: {
        tenantId: command.tenantId,
        employeeId: transfer.employeeId,
      },
    });

    if (employeeRef) {
      employeeRef.companyId = transfer.destinationCompanyId;
      employeeRef.sourceUpdatedAt = new Date();
      employeeRef.sourceVersion = String(Number(employeeRef.sourceVersion || 0) + 1);
      await empRefRepo.save(employeeRef);
      this.logger.log(
        `Transitioned active attribution for employee ${transfer.employeeId} from company ${transfer.sourceCompanyId} to ${transfer.destinationCompanyId}`,
      );
    } else {
      this.logger.warn(
        `Employee reference for employee ${transfer.employeeId} not found during transfer apply.`,
      );
    }

    // 2. Mark transfer status COMPLETED
    transfer.status = EmployeeTransferStatus.COMPLETED;
    transfer.completedAt = new Date();
    await transferRepo.save(transfer);

    // 3. Emit downstream synchronization domain event employee.company-transferred
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.EMPLOYEE_TRANSFER,
      aggregateId: transfer.id,
      eventType: EmployeeTransferEventType.EMPLOYEE_COMPANY_TRANSFERRED,
      payload: {
        transferId: transfer.id,
        tenantId: transfer.tenantId,
        employeeId: transfer.employeeId,
        sourceCompanyId: transfer.sourceCompanyId,
        destinationCompanyId: transfer.destinationCompanyId,
        destinationLocationId: transfer.destinationLocationId,
        destinationDepartmentId: transfer.destinationDepartmentId,
        destinationGradeId: transfer.destinationGradeId,
        destinationJobTitleId: transfer.destinationJobTitleId,
        effectiveAt: transfer.effectiveAt,
        completedAt: transfer.completedAt,
        continuousEmployment: true,
      },
      status: OutboxStatus.PENDING,
    });

    await outboxRepo.save(domainEvent);

    this.logger.log(
      `Successfully applied execution for employee transfer ${transfer.id}. Emitted employee.company-transferred event.`,
    );
  }
}
