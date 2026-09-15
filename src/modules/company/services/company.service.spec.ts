import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { CompanyStatus, SetupStepStatus, SetupStepType } from '../../../enums';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { CompanyEntity } from '../entities/company.entity';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { CopyableCategory } from '../enums/copyable-category.enum';
import { CompanyActivationRejectedException } from '../exceptions/company-activation-rejected.exception';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';
import { CompanyRepository } from '../repositories/company.repository';
import { OutboxEventRepository } from '../repositories/outbox-event.repository';
import { CompanySetupQueryService } from './company-setup-query.service';
import { CompanyService } from './company.service';
import { SetupStepSeederService } from './setup-step-seeder.service';
import { TemplateCopyService } from './template-copy.service';

describe('CompanyService', () => {
  let service: CompanyService;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockSetupStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;
  let mockSeederService: jest.Mocked<Partial<SetupStepSeederService>>;
  let mockCopyService: jest.Mocked<Partial<TemplateCopyService>>;
  let mockSetupQueryService: jest.Mocked<Partial<CompanySetupQueryService>>;
  let mockTransactionService: jest.Mocked<Partial<TransactionService>>;
  let mockOutboxEventRepo: jest.Mocked<Partial<OutboxEventRepository>>;

  const defaultTenantCode = 'TEST_TENANT';
  const defaultUserId = 'user-uuid-1';

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue(defaultTenantCode);
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: defaultUserId,
      sessionId: 'session-uuid-1',
      tenantCode: defaultTenantCode,
      roles: ['admin'],
      scopes: [],
      permissions: ['company:update'],
    });

    mockCompanyRepo = {
      existsByCode: jest.fn().mockResolvedValue(false),
      findTemplateCompany: jest.fn(),
      findById: jest.fn(),
      update: jest
        .fn()
        .mockImplementation((id, data) =>
          Promise.resolve({ id, ...data } as unknown as CompanyEntity),
        ),
      clearTemplateDesignation: jest.fn().mockResolvedValue(undefined),
      setTemplateDesignation: jest.fn().mockImplementation((companyId, isTemplate) =>
        Promise.resolve({
          id: companyId,
          isTemplate,
        } as unknown as CompanyEntity),
      ),
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({
          id: 'new-company-id',
          createdAt: new Date(),
          ...data,
        } as unknown as CompanyEntity),
      ),
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
      } as unknown as CompanySetupStepEntity),
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

    mockSetupQueryService = {
      validateAllStepsCompleted: jest.fn().mockResolvedValue({
        isEligible: true,
        totalSteps: 8,
        completedSteps: 8,
        incompleteSteps: [],
      }),
    };

    mockOutboxEventRepo = {
      create: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ id: 'outbox-id', ...data } as unknown as OutboxEventEntity),
        ),
    };

    mockTransactionService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new CompanyService(
      mockTransactionService as unknown as TransactionService,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      mockSeederService as unknown as SetupStepSeederService,
      mockCopyService as unknown as TemplateCopyService,
      mockSetupQueryService as unknown as CompanySetupQueryService,
      mockOutboxEventRepo as unknown as OutboxEventRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createCompany', () => {
    it('should create a company with PENDING status and write company.created outbox event', async () => {
      const dto = {
        companyCode: 'NEW_CO',
        legalName: 'New Company Legal',
        displayName: 'New Company',
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'UTC',
        copyFromDefault: false,
      };

      const result = await service.createCompany(dto as unknown as CreateCompanyDto);

      expect(result.status).toBe(CompanyStatus.PENDING);
      expect(result.isTemplate).toBe(false);
      expect(mockOutboxEventRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if company code already exists for tenant', async () => {
      (mockCompanyRepo.existsByCode as jest.Mock).mockResolvedValue(true);

      await expect(
        service.createCompany({
          companyCode: 'EXISTING',
          displayName: 'Existing',
          countryCode: 'US',
          currencyCode: 'USD',
          timezone: 'UTC',
        } as unknown as CreateCompanyDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw UnprocessableEntityException if copyFromDefault is true but no template company exists', async () => {
      (mockCompanyRepo.findTemplateCompany as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createCompany({
          companyCode: 'NEW_CO',
          displayName: 'New Company',
          countryCode: 'US',
          currencyCode: 'USD',
          timezone: 'UTC',
          copyFromDefault: true,
        } as unknown as CreateCompanyDto),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should write role-copy.requested outbox event when ROLES is selected in copyCategories', async () => {
      (mockCompanyRepo.findTemplateCompany as jest.Mock).mockResolvedValue({
        id: 'default-co-id',
        isTemplate: true,
      } as unknown as CompanyEntity);

      const result = await service.createCompany({
        companyCode: 'NEW_CO',
        displayName: 'New Company',
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'UTC',
        copyFromDefault: true,
        copyCategories: [CopyableCategory.ROLES],
      } as unknown as CreateCompanyDto);

      expect(result).toBeDefined();
      expect(mockOutboxEventRepo.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateCompanyInformation', () => {
    it('should update company info, mark Step 1 as completed, and write company.updated outbox event', async () => {
      const companyId = 'company-1';

      const existingCompany: Partial<CompanyEntity> = {
        id: companyId,
        companyCode: 'CO_1',
        legalName: 'Original Legal Name',
        displayName: 'Original Display',
        status: CompanyStatus.PENDING,
        countryCode: 'SG',
        currencyCode: 'SGD',
        timezone: 'Asia/Singapore',
        informationCompletedAt: undefined,
      };

      (mockCompanyRepo.findById as jest.Mock)
        .mockResolvedValueOnce(existingCompany as unknown as CompanyEntity)
        .mockResolvedValueOnce({
          ...existingCompany,
          legalName: 'Updated Legal Name',
          informationCompletedAt: new Date(),
        } as unknown as CompanyEntity);

      const result = await service.updateCompanyInformation(companyId, {
        legalName: 'Updated Legal Name',
        taxRegistrationNumber: 'TAX-999',
      });

      expect(mockCompanyRepo.update).toHaveBeenCalled();
      expect(mockSetupStepRepo.markStepCompleted).toHaveBeenCalledWith({
        companyId,
        stepType: SetupStepType.COMPANY_INFORMATION,
        completedBy: defaultUserId,
      });
      expect(mockOutboxEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateId: companyId,
        }),
      );
      expect(result.legalName).toBe('Updated Legal Name');
    });

    it('should allow partial updates on ACTIVE company and preserve existing informationCompletedAt', async () => {
      const companyId = 'company-2';
      const completedDate = new Date('2026-01-01');

      const activeCompany: Partial<CompanyEntity> = {
        id: companyId,
        companyCode: 'CO_2',
        legalName: 'Active Company Legal',
        displayName: 'Active Company',
        status: CompanyStatus.ACTIVE,
        informationCompletedAt: completedDate,
        informationCompletedBy: 'admin-0',
      };

      (mockCompanyRepo.findById as jest.Mock)
        .mockResolvedValueOnce(activeCompany as unknown as CompanyEntity)
        .mockResolvedValueOnce({
          ...activeCompany,
          displayName: 'New Brand Name',
        } as unknown as CompanyEntity);

      const result = await service.updateCompanyInformation(companyId, {
        displayName: 'New Brand Name',
      });

      expect(mockCompanyRepo.update).toHaveBeenCalled();
      expect(mockSetupStepRepo.markStepCompleted).toHaveBeenCalled();
      expect(result.displayName).toBe('New Brand Name');
    });

    it('should throw NotFoundException if company does not exist', async () => {
      (mockCompanyRepo.findById as jest.Mock).mockRejectedValue(new NotFoundException());

      await expect(
        service.updateCompanyInformation('non-existent', {
          displayName: 'Some Name',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('designateDefaultCompany', () => {
    it('should atomically clear old template and set new template company for tenant', async () => {
      const companyId = 'target-company-id';

      const existingCompany: Partial<CompanyEntity> = {
        id: companyId,
        companyCode: 'TARGET_CO',
        isTemplate: false,
      };

      (mockCompanyRepo.findById as jest.Mock).mockResolvedValue(
        existingCompany as unknown as CompanyEntity,
      );

      const result = await service.designateDefaultCompany(companyId);

      expect(mockCompanyRepo.clearTemplateDesignation).toHaveBeenCalled();
      expect(mockCompanyRepo.setTemplateDesignation).toHaveBeenCalledWith(
        companyId,
        true,
        defaultUserId,
      );
      expect(result.isTemplate).toBe(true);
    });

    it('should return immediately if company is already the default template (idempotent)', async () => {
      const companyId = 'already-template-id';
      const existingTemplateCompany: Partial<CompanyEntity> = {
        id: companyId,
        companyCode: 'DEFAULT_CO',
        isTemplate: true,
      };

      (mockCompanyRepo.findById as jest.Mock).mockResolvedValue(
        existingTemplateCompany as unknown as CompanyEntity,
      );

      const result = await service.designateDefaultCompany(companyId);

      expect(result.isTemplate).toBe(true);
      expect(mockCompanyRepo.clearTemplateDesignation).not.toHaveBeenCalled();
      expect(mockCompanyRepo.setTemplateDesignation).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if target company does not exist', async () => {
      (mockCompanyRepo.findById as jest.Mock).mockRejectedValue(new NotFoundException());

      await expect(service.designateDefaultCompany('non-existent-company')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activateCompany', () => {
    const companyId = 'co-pending-1';

    it('should successfully activate company, transition status to ACTIVE, and write company.activated outbox event', async () => {
      const pendingCompany: Partial<CompanyEntity> = {
        id: companyId,
        companyCode: 'VN001',
        legalName: 'Acme Vietnam Ltd',
        displayName: 'Acme Vietnam',
        status: CompanyStatus.PENDING,
      };

      (mockCompanyRepo.findById as jest.Mock)
        .mockResolvedValueOnce(pendingCompany as unknown as CompanyEntity)
        .mockResolvedValueOnce({
          ...pendingCompany,
          status: CompanyStatus.ACTIVE,
          activatedAt: new Date(),
          activatedBy: defaultUserId,
        } as unknown as CompanyEntity);

      const result = await service.activateCompany(companyId);

      expect(mockSetupQueryService.validateAllStepsCompleted).toHaveBeenCalledWith(companyId);
      expect(mockCompanyRepo.update).toHaveBeenCalledWith(
        companyId,
        expect.objectContaining({
          status: CompanyStatus.ACTIVE,
          activatedBy: defaultUserId,
        }),
      );
      expect(mockOutboxEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateId: companyId,
          payload: expect.objectContaining({
            companyId,
            status: CompanyStatus.ACTIVE,
            completedStepsCount: 8,
          }),
        }),
      );
      expect(result.status).toBe(CompanyStatus.ACTIVE);
    });

    it('should reject activation and throw CompanyActivationRejectedException if steps are incomplete', async () => {
      const pendingCompany: Partial<CompanyEntity> = {
        id: companyId,
        companyCode: 'VN001',
        status: CompanyStatus.PENDING,
      };

      (mockCompanyRepo.findById as jest.Mock).mockResolvedValue(
        pendingCompany as unknown as CompanyEntity,
      );

      (mockSetupQueryService.validateAllStepsCompleted as jest.Mock).mockResolvedValueOnce({
        isEligible: false,
        totalSteps: 8,
        completedSteps: 6,
        incompleteSteps: [SetupStepType.DEPARTMENT, SetupStepType.EMPLOYEE_IMPORT],
      });

      await expect(service.activateCompany(companyId)).rejects.toThrow(
        CompanyActivationRejectedException,
      );

      expect(mockCompanyRepo.update).not.toHaveBeenCalled();
      expect(mockOutboxEventRepo.create).not.toHaveBeenCalled();
    });

    it('should throw UnprocessableEntityException if company is already ACTIVE', async () => {
      const activeCompany: Partial<CompanyEntity> = {
        id: companyId,
        companyCode: 'VN001',
        status: CompanyStatus.ACTIVE,
      };

      (mockCompanyRepo.findById as jest.Mock).mockResolvedValue(
        activeCompany as unknown as CompanyEntity,
      );

      await expect(service.activateCompany(companyId)).rejects.toThrow(
        UnprocessableEntityException,
      );

      expect(mockSetupQueryService.validateAllStepsCompleted).not.toHaveBeenCalled();
      expect(mockCompanyRepo.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if company does not exist', async () => {
      (mockCompanyRepo.findById as jest.Mock).mockRejectedValue(new NotFoundException());

      await expect(service.activateCompany('unknown-company-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
