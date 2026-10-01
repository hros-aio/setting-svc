import { TransactionService } from '@new-hros/libs-sql';
import { AggregateType, ChangeOperation, EffectiveEntityType } from '../../../enums';
import { OutboxEventService } from '../../outbox-events/services/outbox-event.service';
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
  let mockOutboxEventService: { fromEffectiveChangeExecute: jest.Mock };
  let mockTxService: { runInTransaction: jest.Mock };

  beforeEach(() => {
    mockLocationHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockDepartmentHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockGradeHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockJobTitleHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockPocHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockEmployeeTransferHandler = { apply: jest.fn().mockResolvedValue(undefined) };

    mockOutboxEventService = {
      fromEffectiveChangeExecute: jest.fn().mockResolvedValue(undefined),
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new EffectiveChangeService(
      mockTxService as unknown as TransactionService,
      mockOutboxEventService as unknown as OutboxEventService,
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
        tenantCode: 'tenant-1',
        companyId: 'comp-A',
        entityType: EffectiveEntityType.JOB_TITLE,
        operation: ChangeOperation.CREATE,
      };

      await service.executeChange(command);

      expect(mockJobTitleHandler.apply).toHaveBeenCalledWith(command);
      expect(mockLocationHandler.apply).not.toHaveBeenCalled();
      expect(mockDepartmentHandler.apply).not.toHaveBeenCalled();
    });
  });

  describe('scheduleExecution [US1]', () => {
    it('should persist an outbox event with EFFECTIVE_CHANGE_EXECUTE when effectiveAt <= now', async () => {
      const pastOrNowDate = new Date(Date.now() - 1000).toISOString();
      const command: EffectiveScheduledCommand = {
        changeId: 'change-123',
        tenantCode: 'tenant-1',
        targetCompanyId: 'comp-1',
        entityType: EffectiveEntityType.DEPARTMENT,
        operation: ChangeOperation.CREATE,
        effectiveAt: pastOrNowDate,
        parameters: { name: 'Engineering' },
      };

      await service.scheduleExecution(command);

      expect(mockTxService.runInTransaction).toHaveBeenCalled();
      expect(mockOutboxEventService.fromEffectiveChangeExecute).toHaveBeenCalledWith(
        command,
        AggregateType.DEPARTMENT,
        EffectiveEntityType.DEPARTMENT,
        ChangeOperation.CREATE,
      );
    });

    it('should skip creating outbox event when effectiveAt is in the future (> now)', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 3).toISOString();
      const command: EffectiveScheduledCommand = {
        changeId: 'change-future',
        tenantCode: 'tenant-1',
        targetCompanyId: 'comp-1',
        entityType: EffectiveEntityType.DEPARTMENT,
        operation: ChangeOperation.CREATE,
        effectiveAt: futureDate,
        parameters: { name: 'Engineering' },
      };

      await service.scheduleExecution(command);

      expect(mockTxService.runInTransaction).not.toHaveBeenCalled();
      expect(mockOutboxEventService.fromEffectiveChangeExecute).not.toHaveBeenCalled();
    });
  });
});
