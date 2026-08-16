import { EventEnvelope } from '@new-hros/libs-events';
import { RoleCopyCompletedConsumer } from './role-copy-completed.consumer';
import { RoleCopyCompletedPayload } from '../types/setup-step-events.types';
import { CompanySetupStepRepository } from '../../modules/company/repositories/company-setup-step.repository';
import { KafkaTopic, SetupStepStatus, SetupStepType } from '../../enums';
import { CompanySetupStepEntity } from '../../modules/company/entities/company-setup-step.entity';

describe('RoleCopyCompletedConsumer', () => {
  let consumer: RoleCopyCompletedConsumer;
  let mockStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;

  beforeEach(() => {
    mockStepRepo = {
      findByCompanyAndStep: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };
    consumer = new RoleCopyCompletedConsumer(mockStepRepo as unknown as CompanySetupStepRepository);
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
        tenantId: 'tenant-1',
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
    expect(mockStep.status).toBe(SetupStepStatus.COMPLETED);
    expect(mockStep.externalReferenceId).toBe('batch-123');
    expect(mockStepRepo.save).toHaveBeenCalledTimes(1);
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
        tenantId: 'tenant-1',
        sourceCompanyId: 'source-1',
        targetCompanyId: 'target-company-1',
      },
    };

    await consumer.handleRoleCopyCompleted(eventEnvelope);

    expect(mockStepRepo.save).not.toHaveBeenCalled();
  });
});
