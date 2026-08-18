import { TransactionService } from '@new-hros/libs-sql';
import { DataSource } from 'typeorm';
import { DepartmentApplyHandler } from '../handlers/department-apply.handler';
import { GradeApplyHandler } from '../handlers/grade-apply.handler';
import { JobTitleApplyHandler } from '../handlers/job-title-apply.handler';
import { EffectiveExecuteCommand, LocationApplyHandler } from '../handlers/location-apply.handler';
import { PocApplyHandler } from '../handlers/poc-apply.handler';
import { EffectiveChangeService } from './effective-change.service';

describe('EffectiveChangeService - Company Scoped Execution [US4]', () => {
  let service: EffectiveChangeService;
  let mockLocationHandler: { apply: jest.Mock };
  let mockDepartmentHandler: { apply: jest.Mock };
  let mockGradeHandler: { apply: jest.Mock };
  let mockJobTitleHandler: { apply: jest.Mock };
  let mockPocHandler: { apply: jest.Mock };
  let mockDataSource: { manager: unknown };
  let mockTxService: { runInTransaction: jest.Mock };

  beforeEach(() => {
    mockLocationHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockDepartmentHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockGradeHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockJobTitleHandler = { apply: jest.fn().mockResolvedValue(undefined) };
    mockPocHandler = { apply: jest.fn().mockResolvedValue(undefined) };

    mockDataSource = {
      manager: {},
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
    );
  });

  it('should delegate execution strictly to the target entity handler with company context intact', async () => {
    const command: EffectiveExecuteCommand = {
      changeId: 'change-1',
      tenantId: 'tenant-1',
      companyId: 'comp-A',
      entityType: 'job_title',
      operation: 'create',
    };

    await service.executeChange(command);

    expect(mockJobTitleHandler.apply).toHaveBeenCalledWith(command, mockDataSource.manager);
    expect(mockLocationHandler.apply).not.toHaveBeenCalled();
    expect(mockDepartmentHandler.apply).not.toHaveBeenCalled();
  });
});
