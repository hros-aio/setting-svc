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
import { EffectiveChangeService } from './effective-change.service';

describe('EffectiveChangeService', () => {
  let service: EffectiveChangeService;
  let mockLocationHandler: { apply: jest.Mock };
  let mockDepartmentHandler: { apply: jest.Mock };
  let mockGradeHandler: { apply: jest.Mock };
  let mockJobTitleHandler: { apply: jest.Mock };
  let mockPocHandler: { apply: jest.Mock };
  let mockEmployeeTransferHandler: { apply: jest.Mock };
  let mockOutboxRepo: { create: jest.Mock; save: jest.Mock };
  let mockDataSource: { manager: { getRepository: jest.Mock } };
  let mockTxService: { runInTransaction: jest.Mock };

  beforeEach(() => {
    mockLocationHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockDepartmentHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockGradeHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockJobTitleHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockPocHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockEmployeeTransferHandler = { apply: jest.fn().mockResolvedValue(undefined) };

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((val) => val),
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockDataSource = {
      manager: {
        getRepository: jest.fn().mockReturnValue(mockOutboxRepo),
      },
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new EffectiveChangeService(
      mockDataSource as unknown as DataSource,
      mockTxService as unknown as TransactionService,
      mockLocationHandler as unknown as LocationApplyHandler,
      mockDepartmentHandler as unknown as DepartmentApplyHandler,
      mockGradeHandler as unknown as GradeApplyHandler,
      mockJobTitleHandler as unknown as JobTitleApplyHandler,
      mockPocHandler as unknown as PocApplyHandler,
      mockEmployeeTransferHandler as unknown as EmployeeTransferApplyHandler,
    );
  });

  describe('executeChange [US4]', () => {
    it('should delegate execution strictly to the target entity handler with company context intact', async () => {
      const command: EffectiveExecuteCommand = {
        changeId: 'change-1',
        tenantId: 'tenant-1',
        companyId: 'comp-A',
        entityType: EffectiveEntityType.JOB_TITLE,
        operation: ChangeOperation.CREATE,
      };

      await service.executeChange(command);

      expect(mockJobTitleHandler.apply).toHaveBeenCalledWith(command, mockDataSource.manager);
      expect(mockLocationHandler.apply).not.toHaveBeenCalled();
      expect(mockDepartmentHandler.apply).not.toHaveBeenCalled();
    });
  });

  describe('scheduleExecution [US1]', () => {
    it('should persist an outbox event with EFFECTIVE_CHANGE_EXECUTE when effectiveAt <= now', async () => {
      const pastOrNowDate = new Date(Date.now() - 1000).toISOString();
      const command: EffectiveScheduledCommand = {
        changeId: 'change-123',
        tenantId: 'tenant-1',
        targetCompanyId: 'comp-1',
        entityType: EffectiveEntityType.DEPARTMENT,
        operation: ChangeOperation.CREATE,
        effectiveAt: pastOrNowDate,
        parameters: { name: 'Engineering' },
      };

      await service.scheduleExecution(command);

      expect(mockTxService.runInTransaction).toHaveBeenCalled();
      expect(mockDataSource.manager.getRepository).toHaveBeenCalledWith(OutboxEventEntity);
      expect(mockOutboxRepo.create).toHaveBeenCalledWith({
        aggregateType: AggregateType.DEPARTMENT,
        aggregateId: 'change-123',
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_EXECUTE,
        payload: {
          changeId: 'change-123',
          entityType: EffectiveEntityType.DEPARTMENT,
          operation: ChangeOperation.CREATE,
          effectiveAt: pastOrNowDate,
          targetCompanyId: 'comp-1',
          tenantId: 'tenant-1',
          parameters: { name: 'Engineering' },
        },
        executionTime: expect.any(Date),
        status: OutboxStatus.PENDING,
      });
      expect(mockOutboxRepo.save).toHaveBeenCalled();
    });

    it('should skip creating outbox event when effectiveAt is in the future (> now)', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 3).toISOString();
      const command: EffectiveScheduledCommand = {
        changeId: 'change-future',
        tenantId: 'tenant-1',
        targetCompanyId: 'comp-1',
        entityType: EffectiveEntityType.DEPARTMENT,
        operation: ChangeOperation.CREATE,
        effectiveAt: futureDate,
        parameters: { name: 'Engineering' },
      };

      await service.scheduleExecution(command);

      expect(mockTxService.runInTransaction).not.toHaveBeenCalled();
      expect(mockOutboxRepo.create).not.toHaveBeenCalled();
      expect(mockOutboxRepo.save).not.toHaveBeenCalled();
    });
  });
});
