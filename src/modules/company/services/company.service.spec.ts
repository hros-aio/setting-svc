import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AuthContext } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CompanyStatus, SetupStepStatus, SetupStepType } from '../../../enums';
import { TenantEntity } from '../../tenant/entities/tenant.entity';
import { TenantRepository } from '../../tenant/repositories/tenant.repository';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { CompanyEntity } from '../entities/company.entity';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { CopyableCategory } from '../enums/copyable-category.enum';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';
import { CompanyRepository } from '../repositories/company.repository';
import { CompanyService } from './company.service';
import { SetupStepSeederService } from './setup-step-seeder.service';
import { TemplateCopyService } from './template-copy.service';

describe('CompanyService', () => {
  let service: CompanyService;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockSetupStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;
  let mockTenantRepo: jest.Mocked<Partial<TenantRepository>>;
  let mockSeederService: jest.Mocked<Partial<SetupStepSeederService>>;
  let mockCopyService: jest.Mocked<Partial<TemplateCopyService>>;
  let mockTransactionService: jest.Mocked<Partial<TransactionService>>;
  let mockOutboxRepo: jest.Mocked<Partial<Repository<OutboxEventEntity>>>;
  let mockDataSource: jest.Mocked<Partial<DataSource>>;

  const defaultTenantId = 'e0000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    mockCompanyRepo = {
      existsByTenantAndCode: jest.fn().mockResolvedValue(false),
      findTemplateCompanyByTenantId: jest.fn(),
      findByIdAndTenant: jest.fn(),
      updateCompanyInfo: jest.fn(),
      clearTemplateDesignation: jest.fn().mockResolvedValue(undefined),
      setTemplateDesignation: jest.fn().mockImplementation((companyId, tenantId, isTemplate) =>
        Promise.resolve({
          id: companyId,
          tenantId,
          isTemplate,
        } as CompanyEntity),
      ),
      createAndSave: jest.fn().mockImplementation((data) =>
        Promise.resolve({
          id: 'new-company-id',
          createdAt: new Date(),
          ...data,
        } as CompanyEntity),
      ),
    };

    mockTenantRepo = {
      findByTenantCode: jest.fn().mockResolvedValue({
        id: defaultTenantId,
        tenantCode: 'TEST_TENANT',
      } as unknown as TenantEntity),
    };

    const mockStep: Partial<CompanySetupStepEntity> = {
      stepType: SetupStepType.COMPANY_INFORMATION,
      stepOrder: 1,
      status: SetupStepStatus.INCOMPLETE,
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({
        ...mockStep,
        status: SetupStepStatus.COMPLETED,
        completedAt: new Date(),
      } as CompanySetupStepEntity),
    };

    mockSeederService = {
      seedMandatorySteps: jest.fn().mockResolvedValue([mockStep as CompanySetupStepEntity]),
    };

    mockCopyService = {
      copyLocalMasterData: jest.fn().mockResolvedValue({
        copiedGradesCount: 1,
        copiedJobTitlesCount: 1,
      }),
    };

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((data) => ({ id: 'outbox-id', ...data })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockOutboxRepo),
      manager: {} as EntityManager,
    };

    mockTransactionService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new CompanyService(
      mockDataSource as unknown as DataSource,
      mockTransactionService as unknown as TransactionService,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      mockTenantRepo as unknown as TenantRepository,
      mockSeederService as unknown as SetupStepSeederService,
      mockCopyService as unknown as TemplateCopyService,
    );
  });

  describe('createCompany', () => {
    it('should create a company with PENDING status and write company.created outbox event', async () => {
      const dto = {
        companyCode: 'NEW_CO',
        name: 'New Company',
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'UTC',
        copyFromDefault: false,
      };

      const result = await service.createCompany(defaultTenantId, dto);

      expect(result.status).toBe(CompanyStatus.PENDING);
      expect(result.isTemplate).toBe(false);
      expect(mockOutboxRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should resolve tenant by tenantCode when non-UUID string is passed', async () => {
      const dto = {
        companyCode: 'NEW_CO',
        name: 'New Company',
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'UTC',
        copyFromDefault: false,
      };

      const result = await service.createCompany('TEST_TENANT', dto);

      expect(mockTenantRepo.findByTenantCode).toHaveBeenCalledWith('TEST_TENANT');
      expect(result.status).toBe(CompanyStatus.PENDING);
    });

    it('should throw ConflictException if company code already exists for tenant', async () => {
      (mockCompanyRepo.existsByTenantAndCode as jest.Mock).mockResolvedValue(true);

      await expect(
        service.createCompany(defaultTenantId, {
          companyCode: 'EXISTING',
          name: 'Existing',
          countryCode: 'US',
          currencyCode: 'USD',
          timezone: 'UTC',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw UnprocessableEntityException if copyFromDefault is true but no template company exists', async () => {
      (mockCompanyRepo.findTemplateCompanyByTenantId as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createCompany(defaultTenantId, {
          companyCode: 'NEW_CO',
          name: 'New Company',
          countryCode: 'US',
          currencyCode: 'USD',
          timezone: 'UTC',
          copyFromDefault: true,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should write role-copy.requested outbox event when ROLES is selected in copyCategories', async () => {
      (mockCompanyRepo.findTemplateCompanyByTenantId as jest.Mock).mockResolvedValue({
        id: 'default-co-id',
        tenantId: defaultTenantId,
        isTemplate: true,
      } as CompanyEntity);

      const result = await service.createCompany(defaultTenantId, {
        companyCode: 'NEW_CO',
        name: 'New Company',
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'UTC',
        copyFromDefault: true,
        copyCategories: [CopyableCategory.ROLES],
      });

      expect(result).toBeDefined();
      expect(mockOutboxRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateCompanyInformation', () => {
    it('should update company info, mark Step 1 as completed, and write company.updated outbox event', async () => {
      const companyId = 'company-1';
      const authContext: AuthContext = {
        userId: 'user-1',
        sessionId: 'session-1',
        tenantCode: 'TEST_TENANT',
        roles: ['admin'],
        scopes: [],
        permissions: ['company:update'],
      };

      const existingCompany: Partial<CompanyEntity> = {
        id: companyId,
        tenantId: defaultTenantId,
        companyCode: 'CO_1',
        legalName: 'Original Legal Name',
        displayName: 'Original Display',
        status: CompanyStatus.PENDING,
        countryCode: 'SG',
        currencyCode: 'SGD',
        timezone: 'Asia/Singapore',
        informationCompletedAt: undefined,
      };

      (mockCompanyRepo.findByIdAndTenant as jest.Mock)
        .mockResolvedValueOnce(existingCompany as CompanyEntity)
        .mockResolvedValueOnce({
          ...existingCompany,
          legalName: 'Updated Legal Name',
          informationCompletedAt: new Date(),
        } as CompanyEntity);

      const result = await service.updateCompanyInformation(
        defaultTenantId,
        companyId,
        {
          legalName: 'Updated Legal Name',
          taxRegistrationNumber: 'TAX-999',
        },
        authContext,
      );

      expect(mockCompanyRepo.updateCompanyInfo).toHaveBeenCalled();
      expect(mockSetupStepRepo.markStepCompleted).toHaveBeenCalledWith({
        tenantId: defaultTenantId,
        companyId,
        stepType: SetupStepType.COMPANY_INFORMATION,
        completedBy: 'user-1',
        entityManager: mockDataSource.manager,
      });
      expect(mockOutboxRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'company.updated',
          aggregateId: companyId,
        }),
      );
      expect(result.legalName).toBe('Updated Legal Name');
    });

    it('should allow partial updates on ACTIVE company and preserve existing informationCompletedAt', async () => {
      const companyId = 'company-2';
      const completedDate = new Date('2026-01-01');
      const authContext: AuthContext = {
        userId: 'admin-1',
        sessionId: 'session-2',
        tenantCode: 'TEST_TENANT',
        roles: ['admin'],
        scopes: [],
        permissions: ['company:update'],
      };

      const activeCompany: Partial<CompanyEntity> = {
        id: companyId,
        tenantId: defaultTenantId,
        companyCode: 'CO_2',
        legalName: 'Active Company Legal',
        displayName: 'Active Company',
        status: CompanyStatus.ACTIVE,
        informationCompletedAt: completedDate,
        informationCompletedBy: 'admin-0',
      };

      (mockCompanyRepo.findByIdAndTenant as jest.Mock)
        .mockResolvedValueOnce(activeCompany as CompanyEntity)
        .mockResolvedValueOnce({
          ...activeCompany,
          displayName: 'New Brand Name',
        } as CompanyEntity);

      const result = await service.updateCompanyInformation(
        defaultTenantId,
        companyId,
        {
          displayName: 'New Brand Name',
        },
        authContext,
      );

      expect(mockCompanyRepo.updateCompanyInfo).toHaveBeenCalled();
      expect(mockSetupStepRepo.markStepCompleted).toHaveBeenCalled();
      expect(result.displayName).toBe('New Brand Name');
    });

    it('should throw NotFoundException if company does not exist for tenant', async () => {
      (mockCompanyRepo.findByIdAndTenant as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateCompanyInformation(defaultTenantId, 'non-existent', {
          name: 'Some Name',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if tenantCode cannot be found in TenantRepository', async () => {
      (mockTenantRepo.findByTenantCode as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateCompanyInformation('INVALID_TENANT', 'company-1', {
          name: 'Some Name',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('designateDefaultCompany', () => {
    it('should atomically clear old template and set new template company for tenant', async () => {
      const companyId = 'target-company-id';
      const authContext: AuthContext = {
        userId: 'admin-user-1',
        sessionId: 'session-1',
        tenantCode: 'TEST_TENANT',
        roles: ['admin'],
        scopes: [],
        permissions: ['company:update'],
      };

      const existingCompany: Partial<CompanyEntity> = {
        id: companyId,
        tenantId: defaultTenantId,
        companyCode: 'TARGET_CO',
        isTemplate: false,
      };

      (mockCompanyRepo.findByIdAndTenant as jest.Mock).mockResolvedValue(
        existingCompany as CompanyEntity,
      );

      const result = await service.designateDefaultCompany(defaultTenantId, companyId, authContext);

      expect(mockCompanyRepo.clearTemplateDesignation).toHaveBeenCalledWith(
        defaultTenantId,
        mockDataSource.manager,
      );
      expect(mockCompanyRepo.setTemplateDesignation).toHaveBeenCalledWith(
        companyId,
        defaultTenantId,
        true,
        'admin-user-1',
        mockDataSource.manager,
      );
      expect(result.isTemplate).toBe(true);
      expect(mockOutboxRepo.save).not.toHaveBeenCalled();
    });

    it('should return immediately if company is already the default template (idempotent)', async () => {
      const companyId = 'already-template-id';
      const existingTemplateCompany: Partial<CompanyEntity> = {
        id: companyId,
        tenantId: defaultTenantId,
        companyCode: 'DEFAULT_CO',
        isTemplate: true,
      };

      (mockCompanyRepo.findByIdAndTenant as jest.Mock).mockResolvedValue(
        existingTemplateCompany as CompanyEntity,
      );

      const result = await service.designateDefaultCompany(defaultTenantId, companyId);

      expect(result.isTemplate).toBe(true);
      expect(mockCompanyRepo.clearTemplateDesignation).not.toHaveBeenCalled();
      expect(mockCompanyRepo.setTemplateDesignation).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if target company does not exist for tenant', async () => {
      (mockCompanyRepo.findByIdAndTenant as jest.Mock).mockResolvedValue(null);

      await expect(
        service.designateDefaultCompany(defaultTenantId, 'non-existent-company'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should resolve tenant code if non-UUID is passed', async () => {
      const companyId = 'target-company-id';
      const existingCompany: Partial<CompanyEntity> = {
        id: companyId,
        tenantId: defaultTenantId,
        isTemplate: false,
      };

      (mockCompanyRepo.findByIdAndTenant as jest.Mock).mockResolvedValue(
        existingCompany as CompanyEntity,
      );

      await service.designateDefaultCompany('TEST_TENANT', companyId);

      expect(mockTenantRepo.findByTenantCode).toHaveBeenCalledWith('TEST_TENANT');
    });
  });
});
