import { RequestContext, RequestContextService } from '@new-hros/libs-core';
import { CompanyStatus, SetupStepStatus, SetupStepType } from '../src/enums';
import { CompanySetupStepEntity } from '../src/modules/company/entities/company-setup-step.entity';
import { CompanyEntity } from '../src/modules/company/entities/company.entity';
import { CompanySetupStepRepository } from '../src/modules/company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../src/modules/company/repositories/company.repository';
import { CompanySetupQueryService } from '../src/modules/company/services/company-setup-query.service';

describe('Company Setup Tracking (Integration / Service Verification)', () => {
  let queryService: CompanySetupQueryService;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;

  const tenantCode = 'ACME_TENANT';
  const companyId = 'c0000000-0000-0000-0000-000000000001';

  const mockCompany: Partial<CompanyEntity> = {
    id: companyId,
    tenantCode,
    companyCode: 'ACME_SG',
    legalName: 'Acme SG Pte Ltd',
    displayName: 'Acme SG',
    status: CompanyStatus.PENDING,
  };

  const mockSteps: Partial<CompanySetupStepEntity>[] = [
    SetupStepType.COMPANY_INFORMATION,
    SetupStepType.LOCATION,
    SetupStepType.DEPARTMENT,
    SetupStepType.GRADE,
    SetupStepType.JOB_TITLE,
    SetupStepType.ROLE,
    SetupStepType.EMPLOYEE_IMPORT,
    SetupStepType.POC,
  ].map((stepType, idx) => ({
    id: `step-${idx + 1}`,
    tenantCode,
    companyId,
    stepType,
    stepOrder: idx + 1,
    status: idx < 3 ? SetupStepStatus.COMPLETED : SetupStepStatus.INCOMPLETE,
    completedAt: idx < 3 ? new Date() : undefined,
    metadata: {},
  }));

  beforeEach(() => {
    mockCompanyRepo = {
      findById: jest.fn().mockImplementation((cId) => {
        if (cId === companyId) {
          return Promise.resolve(mockCompany as unknown as CompanyEntity);
        }
        return Promise.resolve(null);
      }),
    };

    mockStepRepo = {
      findByCompanyId: jest.fn().mockImplementation((cId) => {
        if (cId === companyId) {
          return Promise.resolve(mockSteps as unknown as CompanySetupStepEntity[]);
        }
        return Promise.resolve([]);
      }),
    };

    queryService = new CompanySetupQueryService(
      mockCompanyRepo as unknown as CompanyRepository,
      mockStepRepo as unknown as CompanySetupStepRepository,
    );
  });

  it('should query setup progress and evaluate activation eligibility', async () => {
    const context: RequestContext = {
      traceId: 'trace-1',
      requestId: 'req-1',
      tenantCode: 'ACME_TENANT',
      clientMetadata: {
        ip: '127.0.0.1',
      },
      requestTimestamp: new Date(),
    };

    await RequestContextService.run(context, async () => {
      const progress = await queryService.getCompanySetupProgress(companyId);

      expect(progress.companyId).toBe(companyId);
      expect(progress.totalSteps).toBe(8);
      expect(progress.completedSteps).toBe(3);
      expect(progress.isEligibleForActivation).toBe(false);
      expect(progress.incompleteSteps).toHaveLength(5);
      expect(progress.incompleteSteps).toEqual([
        SetupStepType.GRADE,
        SetupStepType.JOB_TITLE,
        SetupStepType.ROLE,
        SetupStepType.EMPLOYEE_IMPORT,
        SetupStepType.POC,
      ]);
    });
  });

  it('should return isEligible = true when all 8 steps are completed', async () => {
    const allCompletedSteps = mockSteps.map((s) => ({
      ...s,
      status: SetupStepStatus.COMPLETED,
      completedAt: new Date(),
    })) as CompanySetupStepEntity[];

    mockStepRepo.findByCompanyId = jest.fn().mockResolvedValue(allCompletedSteps);

    const validation = await queryService.validateAllStepsCompleted(companyId);

    expect(validation.isEligible).toBe(true);
    expect(validation.completedSteps).toBe(8);
    expect(validation.incompleteSteps).toEqual([]);
  });
});
