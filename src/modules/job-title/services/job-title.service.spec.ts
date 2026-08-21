import { ConflictException } from '@nestjs/common';
import { CrossCompanyReferenceException } from '@new-hros/libs-apis';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource } from 'typeorm';
import { MasterDataStatus } from '../../../enums';
import { CompanyEntity } from '../../company/entities/company.entity';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { Department } from '@new-hros/libs-sql';
import { DepartmentRepository } from '../../department/repositories/department.repository';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { Grade } from '@new-hros/libs-sql';
import { GradeRepository } from '../../grade/repositories/grade.repository';
import { JobTitle } from '@new-hros/libs-sql';
import { JobTitleRepository } from '../repositories/job-title.repository';
import { JobTitleService } from './job-title.service';

describe('JobTitleService - Multi-Company Isolation & Invariants [US1, US2]', () => {
  let service: JobTitleService;
  let mockJobTitleRepo: { [K in keyof JobTitleRepository]?: jest.Mock };
  let mockDeptRepo: { [K in keyof DepartmentRepository]?: jest.Mock };
  let mockGradeRepo: { [K in keyof GradeRepository]?: jest.Mock };
  let mockCompanyRepo: { [K in keyof CompanyRepository]?: jest.Mock };
  let mockSetupStepRepo: { [K in keyof CompanySetupStepRepository]?: jest.Mock };
  let mockDataSource: { manager: { getRepository: jest.Mock } };
  let mockTxService: { runInTransaction: jest.Mock };
  let mockOutboxRepo: { create: jest.Mock; save: jest.Mock };

  const mockAuthContextA: AuthContext = {
    userId: 'user-1',
    sessionId: 'sess-1',
    tenantCode: 'tenant-1',
    roles: ['admin'],
    scopes: [],
    permissions: ['job_title:create'],
  };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-A' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => dto as OutboxEventEntity),
      save: jest.fn().mockResolvedValue({ id: 'outbox-1' } as OutboxEventEntity),
    };

    mockJobTitleRepo = {
      findByCode: jest.fn(),
      findById: jest.fn(),
      createAndSave: jest.fn().mockImplementation((data) => ({ id: 'jt-1', ...data }) as JobTitle),
    };

    mockDeptRepo = {
      findById: jest.fn(),
    };

    mockGradeRepo = {
      findById: jest.fn(),
    };

    mockCompanyRepo = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: 'comp-A',
        tenantId: 'tenant-1',
        timezone: 'UTC',
      } as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as never),
    };

    mockDataSource = {
      manager: {
        getRepository: jest.fn().mockReturnValue(mockOutboxRepo),
      },
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new JobTitleService(
      mockDataSource as unknown as DataSource,
      mockTxService as unknown as TransactionService,
      mockJobTitleRepo as unknown as JobTitleRepository,
      mockDeptRepo as unknown as DepartmentRepository,
      mockGradeRepo as unknown as GradeRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      {} as unknown as EffectiveChangeRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should allow creating Job Title in Company A when department and grade belong to Company A [US1]', async () => {
    mockJobTitleRepo.findByCode!.mockResolvedValue(null);
    mockDeptRepo.findById!.mockResolvedValue({
      id: 'dept-A',
      companyId: 'comp-A',
      status: MasterDataStatus.ACTIVE,
      name: 'Engineering',
    } as Department);
    mockGradeRepo.findById!.mockResolvedValue({
      id: 'grade-A',
      companyId: 'comp-A',
      status: MasterDataStatus.ACTIVE,
      name: 'Level 3',
    } as Grade);

    const result = await service.create(
      {
        code: 'SR_ENG',
        name: 'Senior Engineer',
        departmentId: 'dept-A',
        gradeId: 'grade-A',
        effectiveAt: '2099-01-01T00:00:00Z',
      },
      mockAuthContextA,
    );

    expect(result).toBeDefined();
    expect(mockJobTitleRepo.findByCode).toHaveBeenCalledWith('tenant-1', 'comp-A', 'SR_ENG');
  });

  it('should reject creating duplicate Job Title code within the same Company A', async () => {
    mockJobTitleRepo.findByCode!.mockResolvedValue({
      id: 'existing-jt',
      code: 'SR_ENG',
      companyId: 'comp-A',
    } as JobTitle);

    await expect(
      service.create(
        {
          code: 'SR_ENG',
          name: 'Duplicate Senior Engineer',
          departmentId: 'dept-A',
          gradeId: 'grade-A',
          effectiveAt: '2099-01-01T00:00:00Z',
        },
        mockAuthContextA,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject Job Title creation referencing a Grade from sibling Company B [US2]', async () => {
    mockJobTitleRepo.findByCode!.mockResolvedValue(null);
    mockDeptRepo.findById!.mockResolvedValue({
      id: 'dept-A',
      companyId: 'comp-A',
      status: MasterDataStatus.ACTIVE,
      name: 'Engineering',
    } as Department);
    mockGradeRepo.findById!.mockResolvedValue(null); // Grade belongs to Company B / not found in Company A

    await expect(
      service.create(
        {
          code: 'SR_ENG',
          name: 'Senior Engineer',
          departmentId: 'dept-A',
          gradeId: 'grade-in-comp-B',
          effectiveAt: '2099-01-01T00:00:00Z',
        },
        mockAuthContextA,
      ),
    ).rejects.toThrow(CrossCompanyReferenceException);
  });

  it('should reject Job Title creation referencing a Department from sibling Company B [US2]', async () => {
    mockJobTitleRepo.findByCode!.mockResolvedValue(null);
    mockDeptRepo.findById!.mockResolvedValue(null); // Department belongs to Company B / not found in Company A
    mockGradeRepo.findById!.mockResolvedValue({
      id: 'grade-A',
      companyId: 'comp-A',
      status: MasterDataStatus.ACTIVE,
      name: 'Level 3',
    } as Grade);

    await expect(
      service.create(
        {
          code: 'SR_ENG',
          name: 'Senior Engineer',
          departmentId: 'dept-in-comp-B',
          gradeId: 'grade-A',
          effectiveAt: '2099-01-01T00:00:00Z',
        },
        mockAuthContextA,
      ),
    ).rejects.toThrow(CrossCompanyReferenceException);
  });
});
