import { ConflictException } from '@nestjs/common';
import { CrossCompanyReferenceException } from '@new-hros/libs-apis';
import { RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { MasterDataStatus } from '../../../enums';
import { CompanyEntity } from '../../company/entities/company.entity';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { OutboxEventRepository } from '../../company/repositories/outbox-event.repository';
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
  let mockTxService: { runInTransaction: jest.Mock };
  let mockOutboxEventRepo: { [K in keyof OutboxEventRepository]?: jest.Mock };
  let mockEffectiveChangeRepo: { [K in keyof EffectiveChangeRepository]?: jest.Mock };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-1',
      employee: { companyId: 'comp-A' },
    } as unknown as ReturnType<typeof RequestContextService.getUser>);
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-A' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxEventRepo = {
      create: jest.fn().mockImplementation(async (dto) => ({ id: 'outbox-1', ...dto })),
    };

    mockJobTitleRepo = {
      findByCode: jest.fn(),
      findById: jest.fn(),
      create: jest.fn().mockImplementation(async (data) => ({ id: 'jt-1', ...data }) as JobTitle),
    };

    mockDeptRepo = {
      findById: jest.fn(),
    };

    mockGradeRepo = {
      findById: jest.fn(),
    };

    mockCompanyRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'comp-A',
        timezone: 'UTC',
      } as unknown as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as never),
    };

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (data) => ({ id: 'change-1', ...data })),
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new JobTitleService(
      mockTxService as unknown as TransactionService,
      mockOutboxEventRepo as unknown as OutboxEventRepository,
      mockJobTitleRepo as unknown as JobTitleRepository,
      mockDeptRepo as unknown as DepartmentRepository,
      mockGradeRepo as unknown as GradeRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      mockEffectiveChangeRepo as unknown as EffectiveChangeRepository,
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
      'comp-A',
    );

    expect(result).toBeDefined();
    expect(mockJobTitleRepo.findByCode).toHaveBeenCalledWith('comp-A', 'SR_ENG');
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
        'comp-A',
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
    mockGradeRepo.findById!.mockResolvedValue(null);

    await expect(
      service.create(
        {
          code: 'SR_ENG',
          name: 'Senior Engineer',
          departmentId: 'dept-A',
          gradeId: 'grade-in-comp-B',
          effectiveAt: '2099-01-01T00:00:00Z',
        },
        'comp-A',
      ),
    ).rejects.toThrow(CrossCompanyReferenceException);
  });

  it('should reject Job Title creation referencing a Department from sibling Company B [US2]', async () => {
    mockJobTitleRepo.findByCode!.mockResolvedValue(null);
    mockDeptRepo.findById!.mockResolvedValue(null);
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
        'comp-A',
      ),
    ).rejects.toThrow(CrossCompanyReferenceException);
  });
});
