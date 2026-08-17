import { BadRequestException } from '@nestjs/common';
import { CacheService, RequestContextService } from '@new-hros/libs-core';
import { CompanyStatus, SetupStepStatus, SetupStepType } from '../../../enums';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { CompanyEntity } from '../entities/company.entity';
import { CompanyResponseDto } from '../dto/company-response.dto';
import { CompanyService } from '../services/company.service';
import { CompanySetupQueryService } from '../services/company-setup-query.service';
import { CompanyController } from './company.controller';

describe('CompanyController', () => {
  let controller: CompanyController;
  let mockCompanyService: jest.Mocked<Partial<CompanyService>>;
  let mockSetupQueryService: jest.Mocked<Partial<CompanySetupQueryService>>;
  let mockCacheService: jest.Mocked<Partial<CacheService>>;

  beforeEach(() => {
    mockCompanyService = {
      createCompany: jest.fn(),
      updateCompanyInformation: jest.fn(),
      designateDefaultCompany: jest.fn(),
    };

    mockSetupQueryService = {
      getCompanySetupProgress: jest.fn(),
      validateAllStepsCompleted: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    controller = new CompanyController(
      mockCompanyService as unknown as CompanyService,
      mockSetupQueryService as unknown as CompanySetupQueryService,
      mockCacheService as unknown as CacheService,
    );

    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('TEST_TENANT');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-uuid-1',
      sessionId: 'session-uuid-1',
      tenantCode: 'TEST_TENANT',
      roles: ['admin'],
      scopes: [],
      permissions: ['company:update'],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('updateCompanyInformation', () => {
    it('should update company information and return formatted response', async () => {
      const companyId = 'company-uuid-1';
      const mockUpdatedCompany: Partial<CompanyEntity> = {
        id: companyId,
        tenantId: 'tenant-uuid-1',
        companyCode: 'COMP_1',
        legalName: 'Acme Corp SG Pte Ltd',
        displayName: 'Acme SG',
        status: CompanyStatus.PENDING,
        isTemplate: false,
        countryCode: 'SG',
        currencyCode: 'SGD',
        timezone: 'Asia/Singapore',
        informationCompletedAt: new Date(),
        informationCompletedBy: 'user-uuid-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        setupSteps: [
          {
            id: 'step-1',
            tenantId: 'tenant-uuid-1',
            companyId,
            stepType: SetupStepType.COMPANY_INFORMATION,
            stepOrder: 1,
            status: SetupStepStatus.COMPLETED,
            completedAt: new Date(),
            completedBy: 'user-uuid-1',
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          } as unknown as CompanySetupStepEntity,
        ],
      };

      (mockCompanyService.updateCompanyInformation as jest.Mock).mockResolvedValue(
        mockUpdatedCompany,
      );

      const result = await controller.updateCompanyInformation(companyId, {
        legalName: 'Acme Corp SG Pte Ltd',
        displayName: 'Acme SG',
        countryCode: 'SG',
      });

      expect(result.success).toBe(true);
      expect(result.data.legalName).toBe('Acme Corp SG Pte Ltd');
      expect(result.data.setupSteps?.[0].status).toBe(SetupStepStatus.COMPLETED);
      expect(mockCompanyService.updateCompanyInformation).toHaveBeenCalledWith(
        'TEST_TENANT',
        companyId,
        {
          legalName: 'Acme Corp SG Pte Ltd',
          displayName: 'Acme SG',
          countryCode: 'SG',
        },
        expect.objectContaining({ userId: 'user-uuid-1' }),
      );
    });

    it('should return cached response when idempotency key is matched', async () => {
      const companyId = 'company-uuid-1';
      const cached = {
        success: true,
        data: {
          id: companyId,
          legalName: 'Cached Corp',
        } as unknown as CompanyResponseDto,
      };

      (mockCacheService.get as jest.Mock).mockResolvedValue(cached);

      const result = await controller.updateCompanyInformation(
        companyId,
        { legalName: 'New Name' },
        'idemp-key-123',
      );

      expect(result).toBe(cached);
      expect(mockCompanyService.updateCompanyInformation).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if tenantCode is missing from request context', async () => {
      jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue(null);

      await expect(
        controller.updateCompanyInformation('company-uuid-1', { legalName: 'Acme' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('designateDefaultCompany', () => {
    it('should designate default company and return formatted response with isTemplate: true', async () => {
      const companyId = 'company-uuid-1';
      const mockDesignatedCompany: Partial<CompanyEntity> = {
        id: companyId,
        tenantId: 'tenant-uuid-1',
        companyCode: 'COMP_1',
        legalName: 'Acme Corp SG Pte Ltd',
        displayName: 'Acme SG',
        status: CompanyStatus.ACTIVE,
        isTemplate: true,
        countryCode: 'SG',
        currencyCode: 'SGD',
        timezone: 'Asia/Singapore',
        createdAt: new Date(),
        updatedAt: new Date(),
        setupSteps: [],
      };

      (mockCompanyService.designateDefaultCompany as jest.Mock).mockResolvedValue(
        mockDesignatedCompany,
      );

      const result = await controller.designateDefaultCompany(companyId);

      expect(result.success).toBe(true);
      expect(result.data.isTemplate).toBe(true);
      expect(mockCompanyService.designateDefaultCompany).toHaveBeenCalledWith(
        'TEST_TENANT',
        companyId,
        expect.objectContaining({ userId: 'user-uuid-1' }),
      );
    });
  });

  describe('getCompanySetupProgress', () => {
    it('should return company setup progress from query service', async () => {
      const companyId = 'company-uuid-1';
      const mockProgress = {
        companyId,
        status: 'pending',
        totalSteps: 8,
        completedSteps: 3,
        isEligibleForActivation: false,
        incompleteSteps: [SetupStepType.GRADE],
        steps: [],
      };

      mockSetupQueryService.getCompanySetupProgress = jest.fn().mockResolvedValue(mockProgress);

      const result = await controller.getCompanySetupProgress(companyId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProgress);
      expect(mockSetupQueryService.getCompanySetupProgress).toHaveBeenCalledWith(
        'TEST_TENANT',
        companyId,
      );
    });

    it('should throw BadRequestException if tenantCode is missing from request context', async () => {
      jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue(null);

      await expect(controller.getCompanySetupProgress('company-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('activateCompany', () => {
    it('should activate company and return formatted response with status: ACTIVE', async () => {
      const companyId = 'company-uuid-1';
      const mockActivatedCompany: Partial<CompanyEntity> = {
        id: companyId,
        tenantId: 'tenant-uuid-1',
        companyCode: 'COMP_1',
        legalName: 'Acme Corp SG Pte Ltd',
        displayName: 'Acme SG',
        status: CompanyStatus.ACTIVE,
        isTemplate: false,
        countryCode: 'SG',
        currencyCode: 'SGD',
        timezone: 'Asia/Singapore',
        activatedAt: new Date(),
        activatedBy: 'user-uuid-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        setupSteps: [],
      };

      mockCompanyService.activateCompany = jest.fn().mockResolvedValue(mockActivatedCompany);

      const result = await controller.activateCompany(companyId);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(CompanyStatus.ACTIVE);
      expect(mockCompanyService.activateCompany).toHaveBeenCalledWith(
        'TEST_TENANT',
        companyId,
        expect.objectContaining({ userId: 'user-uuid-1' }),
      );
    });

    it('should throw BadRequestException if tenantCode is missing from request context', async () => {
      jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue(null);

      await expect(controller.activateCompany('company-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
