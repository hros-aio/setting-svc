import { DataSource, EntityManager, Repository } from 'typeorm';
import { SetupStepStatus, SetupStepType } from '../../../enums';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { CompanySetupStepRepository } from './company-setup-step.repository';

describe('CompanySetupStepRepository', () => {
  let repository: CompanySetupStepRepository;
  let mockEntityManager: jest.Mocked<EntityManager>;
  let mockInnerRepo: jest.Mocked<Repository<CompanySetupStepEntity>>;
  let mockDataSource: jest.Mocked<DataSource>;

  beforeEach(() => {
    mockInnerRepo = {
      create: jest.fn().mockImplementation((entity: unknown) => entity),
      save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<CompanySetupStepEntity>>;

    mockEntityManager = {
      getRepository: jest.fn().mockReturnValue(mockInnerRepo),
    } as unknown as jest.Mocked<EntityManager>;

    mockDataSource = {
      createEntityManager: jest.fn().mockReturnValue(mockEntityManager),
    } as unknown as jest.Mocked<DataSource>;

    repository = new CompanySetupStepRepository(mockDataSource);
  });

  describe('findStepsByCompanyId', () => {
    it('should query steps ordered by stepOrder ASC with manager', async () => {
      const mockSteps = [
        { id: '1', stepOrder: 1, stepType: SetupStepType.COMPANY_INFORMATION },
        { id: '2', stepOrder: 2, stepType: SetupStepType.LOCATION },
      ] as unknown as CompanySetupStepEntity[];

      (mockInnerRepo.find as jest.Mock).mockResolvedValue(mockSteps);

      const result = await repository.findStepsByCompanyId('company-1', mockEntityManager);

      expect(mockInnerRepo.find).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        order: { stepOrder: 'ASC' },
      });
      expect(result).toEqual(mockSteps);
    });
  });

  describe('markStepCompleted', () => {
    it('should transition INCOMPLETE step to COMPLETED with metadata and external reference', async () => {
      const existingStep = {
        id: 'step-1',
        tenantId: 'tenant-1',
        companyId: 'company-1',
        stepType: SetupStepType.LOCATION,
        status: SetupStepStatus.INCOMPLETE,
        completedAt: undefined,
        metadata: {},
      } as unknown as CompanySetupStepEntity;

      (mockInnerRepo.findOne as jest.Mock).mockResolvedValue(existingStep);
      (mockInnerRepo.save as jest.Mock).mockImplementation((step) => Promise.resolve(step));

      const result = await repository.markStepCompleted({
        tenantId: 'tenant-1',
        companyId: 'company-1',
        stepType: SetupStepType.LOCATION,
        completedBy: 'user-1',
        metadata: { completedViaCopy: true },
        externalReferenceId: 'ref-123',
        entityManager: mockEntityManager,
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
        tenantId: 'tenant-1',
        companyId: 'company-1',
        stepType: SetupStepType.LOCATION,
        status: SetupStepStatus.COMPLETED,
        completedAt: new Date('2026-08-10'),
        metadata: { initial: true },
      } as unknown as CompanySetupStepEntity;

      (mockInnerRepo.findOne as jest.Mock).mockResolvedValue(existingStep);
      (mockInnerRepo.save as jest.Mock).mockImplementation((step) => Promise.resolve(step));

      const result = await repository.markStepCompleted({
        tenantId: 'tenant-1',
        companyId: 'company-1',
        stepType: SetupStepType.LOCATION,
        completedBy: 'user-2',
        metadata: { extra: 'value' },
        entityManager: mockEntityManager,
      });

      expect(result?.status).toBe(SetupStepStatus.COMPLETED);
      expect(result?.metadata).toEqual({ initial: true, extra: 'value' });
    });

    it('should return null if step row is not found', async () => {
      (mockInnerRepo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await repository.markStepCompleted({
        tenantId: 'tenant-1',
        companyId: 'company-1',
        stepType: SetupStepType.LOCATION,
        entityManager: mockEntityManager,
      });

      expect(result).toBeNull();
    });
  });
});
