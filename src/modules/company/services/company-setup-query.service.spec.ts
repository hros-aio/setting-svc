import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { SetupStepStatus, SetupStepType } from '../../../enums';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { CompanyEntity } from '../entities/company.entity';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';
import { CompanyRepository } from '../repositories/company.repository';
import { TenantRepository } from '../../tenant/repositories/tenant.repository';
import { TenantEntity } from '../../tenant/entities/tenant.entity';
import { CompanySetupQueryService } from './company-setup-query.service';

describe('CompanySetupQueryService', () => {
  let service: CompanySetupQueryService;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockSetupStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;
  let mockTenantRepo: jest.Mocked<Partial<TenantRepository>>;

  const tenantId = 'e0000000-0000-0000-0000-000000000001';
  const companyId = 'c0000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    mockCompanyRepo = {
      findByIdAndTenant: jest.fn(),
    };
    mockSetupStepRepo = {
      findStepsByCompanyId: jest.fn(),
    };
    mockTenantRepo = {
      findByTenantCode: jest
        .fn()
        .mockResolvedValue({ id: tenantId, tenantCode: 'ACME' } as unknown as TenantEntity),
    };

    service = new CompanySetupQueryService(
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      mockTenantRepo as unknown as TenantRepository,
    );
  });

  describe('getCompanySetupProgress', () => {
    it('should return progress model with isEligibleForActivation = false when steps are incomplete', async () => {
      mockCompanyRepo.findByIdAndTenant = jest.fn().mockResolvedValue({
        id: companyId,
        tenantId,
        status: 'pending',
      } as CompanyEntity);

      const mockSteps = [
        {
          stepType: SetupStepType.COMPANY_INFORMATION,
          stepOrder: 1,
          status: SetupStepStatus.COMPLETED,
          completedAt: new Date(),
        },
        {
          stepType: SetupStepType.LOCATION,
          stepOrder: 2,
          status: SetupStepStatus.COMPLETED,
          completedAt: new Date(),
        },
        {
          stepType: SetupStepType.DEPARTMENT,
          stepOrder: 3,
          status: SetupStepStatus.INCOMPLETE,
        },
        {
          stepType: SetupStepType.GRADE,
          stepOrder: 4,
          status: SetupStepStatus.INCOMPLETE,
        },
        {
          stepType: SetupStepType.JOB_TITLE,
          stepOrder: 5,
          status: SetupStepStatus.INCOMPLETE,
        },
        {
          stepType: SetupStepType.ROLE,
          stepOrder: 6,
          status: SetupStepStatus.INCOMPLETE,
        },
        {
          stepType: SetupStepType.EMPLOYEE_IMPORT,
          stepOrder: 7,
          status: SetupStepStatus.INCOMPLETE,
        },
        {
          stepType: SetupStepType.POC,
          stepOrder: 8,
          status: SetupStepStatus.INCOMPLETE,
        },
      ] as unknown as CompanySetupStepEntity[];

      mockSetupStepRepo.findStepsByCompanyId = jest.fn().mockResolvedValue(mockSteps);

      const result = await service.getCompanySetupProgress(tenantId, companyId);

      expect(result.companyId).toBe(companyId);
      expect(result.totalSteps).toBe(8);
      expect(result.completedSteps).toBe(2);
      expect(result.isEligibleForActivation).toBe(false);
      expect(result.incompleteSteps).toHaveLength(6);
      expect(result.incompleteSteps).toContain(SetupStepType.DEPARTMENT);
    });

    it('should return isEligibleForActivation = true when all 8 steps are COMPLETED', async () => {
      mockCompanyRepo.findByIdAndTenant = jest.fn().mockResolvedValue({
        id: companyId,
        tenantId,
        status: 'pending',
      } as CompanyEntity);

      const allCompletedSteps = [
        SetupStepType.COMPANY_INFORMATION,
        SetupStepType.LOCATION,
        SetupStepType.DEPARTMENT,
        SetupStepType.GRADE,
        SetupStepType.JOB_TITLE,
        SetupStepType.ROLE,
        SetupStepType.EMPLOYEE_IMPORT,
        SetupStepType.POC,
      ].map((type, idx) => ({
        stepType: type,
        stepOrder: idx + 1,
        status: SetupStepStatus.COMPLETED,
        completedAt: new Date(),
      })) as unknown as CompanySetupStepEntity[];

      mockSetupStepRepo.findStepsByCompanyId = jest.fn().mockResolvedValue(allCompletedSteps);

      const result = await service.getCompanySetupProgress(tenantId, companyId);

      expect(result.totalSteps).toBe(8);
      expect(result.completedSteps).toBe(8);
      expect(result.isEligibleForActivation).toBe(true);
      expect(result.incompleteSteps).toEqual([]);
    });

    it('should throw NotFoundException if company does not exist for tenant', async () => {
      mockCompanyRepo.findByIdAndTenant = jest.fn().mockResolvedValue(null);

      await expect(service.getCompanySetupProgress(tenantId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnprocessableEntityException if no setup step rows exist', async () => {
      mockCompanyRepo.findByIdAndTenant = jest.fn().mockResolvedValue({
        id: companyId,
        tenantId,
      } as CompanyEntity);

      mockSetupStepRepo.findStepsByCompanyId = jest.fn().mockResolvedValue([]);

      await expect(service.getCompanySetupProgress(tenantId, companyId)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
