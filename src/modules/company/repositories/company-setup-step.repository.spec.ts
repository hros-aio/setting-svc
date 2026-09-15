import { TransactionService } from '@new-hros/libs-sql';
import { EntityManager, Repository } from 'typeorm';
import { SetupStepStatus, SetupStepType } from '../../../enums';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { CompanySetupStepRepository } from './company-setup-step.repository';

describe('CompanySetupStepRepository', () => {
  let repository: CompanySetupStepRepository;
  let mockEntityManager: jest.Mocked<EntityManager>;
  let mockInnerRepo: jest.Mocked<Repository<CompanySetupStepEntity>>;
  let mockTransactionService: jest.Mocked<TransactionService>;

  beforeEach(() => {
    mockInnerRepo = {
      create: jest.fn().mockImplementation((entity: unknown) => entity),
      save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest
        .fn()
        .mockImplementation((id: string, values: Record<string, unknown>) =>
          Promise.resolve({ id, ...values }),
        ),
    } as unknown as jest.Mocked<Repository<CompanySetupStepEntity>>;

    mockEntityManager = {
      getRepository: jest.fn().mockReturnValue(mockInnerRepo),
    } as unknown as jest.Mocked<EntityManager>;

    mockTransactionService = {
      getManager: jest.fn().mockReturnValue(mockEntityManager),
      defaultManager: mockEntityManager,
      runInTransaction: jest
        .fn()
        .mockImplementation((fn: (em: EntityManager) => unknown) => fn(mockEntityManager)),
    } as unknown as jest.Mocked<TransactionService>;

    repository = new CompanySetupStepRepository(mockTransactionService);
  });

  describe('findStepsByCompanyId', () => {
    it('should query steps ordered by stepOrder ASC', async () => {
      const mockSteps = [
        { id: '1', stepOrder: 1, stepType: SetupStepType.COMPANY_INFORMATION },
        { id: '2', stepOrder: 2, stepType: SetupStepType.LOCATION },
      ] as unknown as CompanySetupStepEntity[];

      (mockInnerRepo.find as jest.Mock).mockResolvedValue(mockSteps);

      const result = await repository.findByCompanyId('company-1');

      expect(mockInnerRepo.find).toHaveBeenCalledWith({
        where: { companyId: 'company-1', tenantCode: '000000' },
        order: { stepOrder: 'ASC' },
      });
      expect(result).toEqual(mockSteps);
    });
  });

  describe('markStepCompleted', () => {
    it('should transition INCOMPLETE step to COMPLETED with metadata and external reference', async () => {
      const existingStep = {
        id: 'step-1',
        companyId: 'company-1',
        stepType: SetupStepType.LOCATION,
        status: SetupStepStatus.INCOMPLETE,
        completedAt: undefined,
        metadata: {},
      } as unknown as CompanySetupStepEntity;

      (mockInnerRepo.findOne as jest.Mock).mockResolvedValue(existingStep);

      const result = await repository.markStepCompleted({
        companyId: 'company-1',
        stepType: SetupStepType.LOCATION,
        completedBy: 'user-1',
        metadata: { completedViaCopy: true },
        externalReferenceId: 'ref-123',
      });

      expect(result?.status).toBe(SetupStepStatus.COMPLETED);
      expect(result?.completedBy).toBe('user-1');
      expect(result?.completedAt).toBeDefined();
      expect(result?.metadata).toEqual({ completedViaCopy: true });
      expect(result?.externalReferenceId).toBe('ref-123');
    });

    it('should be idempotent and update metadata if step is already COMPLETED', async () => {
      const existingStep = {
        id: 'step-1',
        companyId: 'company-1',
        stepType: SetupStepType.LOCATION,
        status: SetupStepStatus.COMPLETED,
        completedAt: new Date('2026-08-10'),
        metadata: { initial: true },
      } as unknown as CompanySetupStepEntity;

      (mockInnerRepo.findOne as jest.Mock).mockResolvedValue(existingStep);

      const result = await repository.markStepCompleted({
        companyId: 'company-1',
        stepType: SetupStepType.LOCATION,
        completedBy: 'user-2',
        metadata: { extra: 'value' },
      });

      expect(result?.metadata).toEqual({ initial: true, extra: 'value' });
    });

    it('should return null if step row is not found', async () => {
      (mockInnerRepo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await repository.markStepCompleted({
        companyId: 'company-1',
        stepType: SetupStepType.LOCATION,
      });

      expect(result).toBeNull();
    });
  });
});
