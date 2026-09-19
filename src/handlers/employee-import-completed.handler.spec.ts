import { CacheService } from '@new-hros/libs-core';
import { EventEnvelope } from '@new-hros/libs-events';
import { KafkaTopic, SetupStepStatus, SetupStepType } from '../enums';
import { CompanySetupStepEntity } from '../modules/company/entities/company-setup-step.entity';
import { CompanySetupStepRepository } from '../modules/company/repositories/company-setup-step.repository';
import {
  EmployeeImportCompletedHandler,
  EmployeeImportCompletedPayload,
} from './employee-import-completed.handler';

describe('EmployeeImportCompletedConsumer', () => {
  let consumer: EmployeeImportCompletedHandler;
  let mockStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;
  let mockCacheService: jest.Mocked<Partial<CacheService>>;

  beforeEach(() => {
    mockStepRepo = {
      findByCompanyAndStep: jest.fn(),
      markStepCompleted: jest.fn().mockResolvedValue(null),
    };
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      executeIfAbsent: jest.fn().mockImplementation(async (_key, cb) => {
        await cb();
        return { executed: true };
      }),
    };
    consumer = new EmployeeImportCompletedHandler(
      mockStepRepo as unknown as CompanySetupStepRepository,
      mockCacheService as unknown as CacheService,
    );
  });

  it('should mark EMPLOYEE_IMPORT setup step as COMPLETED when consuming completion event', async () => {
    const mockStep: Partial<CompanySetupStepEntity> = {
      id: 'step-uuid',
      companyId: 'company-1',
      stepType: SetupStepType.EMPLOYEE_IMPORT,
      status: SetupStepStatus.INCOMPLETE,
      metadata: {},
    };

    (mockStepRepo.findByCompanyAndStep as jest.Mock).mockResolvedValue(mockStep);

    const eventEnvelope: EventEnvelope<EmployeeImportCompletedPayload> = {
      id: 'evt-import-1',
      topic: KafkaTopic.EMPLOYEE_IMPORT_BATCH_COMPLETED,
      producer: 'employee-import-svc',
      version: '1.0',
      correlationId: 'c-import-1',
      timestamp: new Date().toISOString(),
      payload: {
        batchId: 'batch-import-123',
        tenantCode: 'tenant-1',
        companyId: 'company-1',
        importedCount: 50,
      },
    };

    await consumer.handleEmployeeImportCompleted(eventEnvelope);

    expect(mockStepRepo.findByCompanyAndStep).toHaveBeenCalledWith(
      'company-1',
      SetupStepType.EMPLOYEE_IMPORT,
    );
    expect(mockStepRepo.markStepCompleted).toHaveBeenCalledWith({
      companyId: 'company-1',
      stepType: SetupStepType.EMPLOYEE_IMPORT,
      externalReferenceId: 'batch-import-123',
      metadata: { importedCount: 50 },
    });
  });

  it('should skip duplicate event if cached in Redis', async () => {
    (mockCacheService.executeIfAbsent as jest.Mock).mockResolvedValue({ executed: false });

    const eventEnvelope: EventEnvelope<EmployeeImportCompletedPayload> = {
      id: 'evt-import-2',
      topic: KafkaTopic.EMPLOYEE_IMPORT_BATCH_COMPLETED,
      producer: 'employee-import-svc',
      version: '1.0',
      correlationId: 'c-import-2',
      timestamp: new Date().toISOString(),
      payload: {
        batchId: 'batch-import-123',
        tenantCode: 'tenant-1',
        companyId: 'company-1',
      },
    };

    await consumer.handleEmployeeImportCompleted(eventEnvelope);

    expect(mockStepRepo.findByCompanyAndStep).not.toHaveBeenCalled();
  });
});
