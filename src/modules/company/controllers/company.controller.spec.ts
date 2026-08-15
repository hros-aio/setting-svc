import { BadRequestException } from '@nestjs/common';
import { CacheService, RequestContextService } from '@new-hros/libs-core';
import { CompanyStatus, SetupStepStatus, SetupStepType } from '../../../enums';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { CompanyEntity } from '../entities/company.entity';
import { CompanyResponseDto } from '../dto/company-response.dto';
import { CompanyService } from '../services/company.service';
import { CompanyController } from './company.controller';

describe('CompanyController', () => {
  let controller: CompanyController;
  let mockCompanyService: jest.Mocked<Partial<CompanyService>>;
  let mockCacheService: jest.Mocked<Partial<CacheService>>;

  beforeEach(() => {
    mockCompanyService = {
      createCompany: jest.fn(),
      updateCompanyInformation: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    controller = new CompanyController(
      mockCompanyService as unknown as CompanyService,
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
});
