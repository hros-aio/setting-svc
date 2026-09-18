import { Injectable, Logger } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { OutboxEventRepository } from 'src/modules/company/repositories/outbox-event.repository';
import {
  AggregateType,
  EffectiveChangeEventType,
  EmployeeTransferStatus,
  OutboxStatus,
} from '../../../enums';
import { InitiateEmployeeTransferDto } from '../dtos/initiate-employee-transfer.dto';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferRepository } from '../repositories/employee-transfer.repository';
import { ValidateTransferRequestService } from './validate-transfer-request.service';

@Injectable()
export class EmployeeTransferService {
  private readonly logger = new Logger(EmployeeTransferService.name);

  constructor(
    private readonly validateTransferRequestService: ValidateTransferRequestService,
    private readonly transactionService: TransactionService,
    private readonly employeeTransferRepository: EmployeeTransferRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  async initiateTransfer(dto: InitiateEmployeeTransferDto): Promise<EmployeeTransferEntity> {
    const tenantCode = RequestContextService.getTenantCode();
    const userId = RequestContextService.getUser().userId;

    const { employeeId, companyId: sourceCompanyId } = dto;

    return this.transactionService.runInTransaction(async () => {
      // 1. Run full business validation pipeline within transaction
      const validated = await this.validateTransferRequestService.validate(
        sourceCompanyId,
        employeeId,
        dto,
      );

      // 2. Persist pending transfer record
      const savedTransfer = await this.employeeTransferRepository.create({
        tenantCode,
        id: employeeId,
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

      // 3. Atomically stage outbox event for scheduling
      await this.outboxEventRepository.create({
        aggregateType: AggregateType.EMPLOYEE_TRANSFER,
        aggregateId: savedTransfer.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          transferId: savedTransfer.id,
          changeType: 'EMPLOYEE_TRANSFER',
          tenantCode,
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

      this.logger.log(
        `Scheduled transfer ${savedTransfer.id} for employee ${employeeId} from company ${sourceCompanyId} to ${dto.destinationCompanyId} effective at ${savedTransfer.effectiveAt}`,
      );

      return savedTransfer;
    });
  }
}
