import { CacheService } from '@new-hros/libs-core';
import { EventEnvelope } from '@new-hros/libs-events';
import { KafkaTopic, SetupStepStatus, SetupStepType } from '../enums';
import { CompanySetupStepEntity } from '../modules/company/entities/company-setup-step.entity';
import { CompanySetupStepRepository } from '../modules/company/repositories/company-setup-step.repository';
import { RoleCopyCompletedHandler, RoleCopyCompletedPayload } from './role-copy-completed.handler';

describe('RoleCopyCompletedConsumer', () => {
  let consumer: RoleCopyCompletedHandler;
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
    consumer = new RoleCopyCompletedHandler(
      mockStepRepo as unknown as CompanySetupStepRepository,
      mockCacheService as unknown as CacheService,
    );
  });

  it('should mark ROLE setup step as COMPLETED when consuming completion event', async () => {
    const mockStep: Partial<CompanySetupStepEntity> = {
      id: 'step-uuid',
      companyId: 'target-company-1',
      stepType: SetupStepType.ROLE,
      status: SetupStepStatus.INCOMPLETE,
      metadata: {},
    };

    (mockStepRepo.findByCompanyAndStep as jest.Mock).mockResolvedValue(mockStep);

    const eventEnvelope: EventEnvelope<RoleCopyCompletedPayload> = {
      id: 'evt-1',
      topic: KafkaTopic.AUTHORIZATION_ROLE_COPY_COMPLETED,
      producer: 'auth-svc',
      version: '1.0',
      correlationId: 'c-1',
      timestamp: new Date().toISOString(),
      payload: {
        batchId: 'batch-123',
        tenantCode: 'tenant-1',
        sourceCompanyId: 'source-1',
        targetCompanyId: 'target-company-1',
        copiedRoleCount: 5,
      },
    };

    await consumer.handleRoleCopyCompleted(eventEnvelope);

    expect(mockStepRepo.findByCompanyAndStep).toHaveBeenCalledWith(
      'target-company-1',
      SetupStepType.ROLE,
    );
    expect(mockStepRepo.markStepCompleted).toHaveBeenCalledWith({
      companyId: 'target-company-1',
      stepType: SetupStepType.ROLE,
      externalReferenceId: 'batch-123',
      metadata: {
        roleCount: 5,
        sourceCompanyId: 'source-1',
      },
    });
  });

  it('should be idempotent and not re-save if step is already COMPLETED', async () => {
    const mockStep: Partial<CompanySetupStepEntity> = {
      id: 'step-uuid',
      companyId: 'target-company-1',
      stepType: SetupStepType.ROLE,
      status: SetupStepStatus.COMPLETED,
    };

    (mockStepRepo.findByCompanyAndStep as jest.Mock).mockResolvedValue(mockStep);

    const eventEnvelope: EventEnvelope<RoleCopyCompletedPayload> = {
      id: 'evt-2',
      topic: KafkaTopic.AUTHORIZATION_ROLE_COPY_COMPLETED,
      producer: 'auth-svc',
      version: '1.0',
      correlationId: 'c-2',
      timestamp: new Date().toISOString(),
      payload: {
        batchId: 'batch-123',
        tenantCode: 'tenant-1',
        sourceCompanyId: 'source-1',
        targetCompanyId: 'target-company-1',
      },
    };

    await consumer.handleRoleCopyCompleted(eventEnvelope);

    expect(mockStepRepo.markStepCompleted).not.toHaveBeenCalled();
  });
});
