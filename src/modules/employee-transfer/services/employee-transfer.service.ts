import { Injectable, Logger } from '@nestjs/common';
import { AuthContext } from '@new-hros/libs-core';
import { DataSource, EntityManager } from 'typeorm';
import {
  AggregateType,
  EffectiveChangeEventType,
  EmployeeTransferStatus,
  OutboxStatus,
} from '../../../enums';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { InitiateEmployeeTransferDto } from '../dtos/initiate-employee-transfer.dto';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { ValidateTransferRequestService } from './validate-transfer-request.service';

@Injectable()
export class EmployeeTransferService {
  private readonly logger = new Logger(EmployeeTransferService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly validateTransferRequestService: ValidateTransferRequestService,
  ) {}

  async initiateTransfer(
    tenantId: string,
    sourceCompanyId: string,
    employeeId: string,
    dto: InitiateEmployeeTransferDto,
    authContext?: AuthContext | null,
  ): Promise<EmployeeTransferEntity> {
    const userId = authContext?.userId;

    return this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Run full business validation pipeline within transaction
      const validated = await this.validateTransferRequestService.validate(
        tenantId,
        sourceCompanyId,
        employeeId,
        dto,
        manager,
      );

      // 2. Persist pending transfer record
      const transferRepo = manager.getRepository(EmployeeTransferEntity);
      const transfer = transferRepo.create({
        tenantId,
        employeeId,
        sourceCompanyId,
        destinationCompanyId: dto.destinationCompanyId,
        destinationLocationId: dto.destinationLocationId,
        destinationDepartmentId: dto.destinationDepartmentId,
        destinationGradeId: dto.destinationGradeId,
        destinationJobTitleId: dto.destinationJobTitleId,
        status: EmployeeTransferStatus.PENDING,
        effectiveAt: validated.effectiveAt,
        notes: dto.notes,
        createdBy: userId,
        updatedBy: userId,
      });

      const savedTransfer = await transferRepo.save(transfer);

      // 3. Atomically stage outbox event for scheduling
      const outboxRepo = manager.getRepository(OutboxEventEntity);
      const scheduledEvent = outboxRepo.create({
        aggregateType: AggregateType.EMPLOYEE_TRANSFER,
        aggregateId: savedTransfer.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          transferId: savedTransfer.id,
          changeType: 'EMPLOYEE_TRANSFER',
          tenantId,
          employeeId,
          sourceCompanyId,
          destinationCompanyId: dto.destinationCompanyId,
          destinationLocationId: dto.destinationLocationId,
          destinationDepartmentId: dto.destinationDepartmentId,
          destinationGradeId: dto.destinationGradeId,
          destinationJobTitleId: dto.destinationJobTitleId,
          effectiveAt: savedTransfer.effectiveAt,
        },
        executionTime: savedTransfer.effectiveAt,
        status: OutboxStatus.PENDING,
      });

      await outboxRepo.save(scheduledEvent);

      this.logger.log(
        `Scheduled transfer ${savedTransfer.id} for employee ${employeeId} from company ${sourceCompanyId} to ${dto.destinationCompanyId} effective at ${savedTransfer.effectiveAt}`,
      );

      return savedTransfer;
    });
  }
}
