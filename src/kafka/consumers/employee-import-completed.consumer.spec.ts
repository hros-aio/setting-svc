import { CacheService } from '@new-hros/libs-core';
import { EventEnvelope } from '@new-hros/libs-events';
import { KafkaTopic, SetupStepStatus, SetupStepType } from '../../enums';
import { CompanySetupStepEntity } from '../../modules/company/entities/company-setup-step.entity';
import { CompanySetupStepRepository } from '../../modules/company/repositories/company-setup-step.repository';
import { EmployeeImportCompletedPayload } from '../types/setup-step-events.types';
import { EmployeeImportCompletedConsumer } from './employee-import-completed.consumer';

describe('EmployeeImportCompletedConsumer', () => {
  let consumer: EmployeeImportCompletedConsumer;
  let mockStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;
  let mockCacheService: jest.Mocked<Partial<CacheService>>;

  beforeEach(() => {
    mockStepRepo = {
      findByCompanyAndStep: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    consumer = new EmployeeImportCompletedConsumer(
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
        tenantId: 'tenant-1',
        companyId: 'company-1',
        importedCount: 50,
      },
    };

    await consumer.handleEmployeeImportCompleted(eventEnvelope);

    expect(mockStepRepo.findByCompanyAndStep).toHaveBeenCalledWith(
      'company-1',
      SetupStepType.EMPLOYEE_IMPORT,
    );
    expect(mockStep.status).toBe(SetupStepStatus.COMPLETED);
    expect(mockStep.externalReferenceId).toBe('batch-import-123');
    expect(mockStep.metadata).toEqual({ importedCount: 50 });
    expect(mockStepRepo.save).toHaveBeenCalledTimes(1);
    expect(mockCacheService.set).toHaveBeenCalledTimes(1);
  });

  it('should skip duplicate event if cached in Redis', async () => {
    (mockCacheService.get as jest.Mock).mockResolvedValue(true);

    const eventEnvelope: EventEnvelope<EmployeeImportCompletedPayload> = {
      id: 'evt-import-2',
      topic: KafkaTopic.EMPLOYEE_IMPORT_BATCH_COMPLETED,
      producer: 'employee-import-svc',
      version: '1.0',
      correlationId: 'c-import-2',
      timestamp: new Date().toISOString(),
      payload: {
        batchId: 'batch-import-123',
        tenantId: 'tenant-1',
        companyId: 'company-1',
      },
    };

    await consumer.handleEmployeeImportCompleted(eventEnvelope);

    expect(mockStepRepo.findByCompanyAndStep).not.toHaveBeenCalled();
  });
});
