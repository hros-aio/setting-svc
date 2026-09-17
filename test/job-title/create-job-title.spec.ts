import { BadRequestException, ConflictException } from '@nestjs/common';
import { JobTitleService } from '../../src/modules/job-title/services/job-title.service';
import { MasterDataStatus, SetupStepType } from '../../src/enums';
import { JobTitleRepository } from '../../src/modules/job-title/repositories/job-title.repository';
import { DepartmentRepository } from '../../src/modules/department/repositories/department.repository';
import { GradeRepository } from '../../src/modules/grade/repositories/grade.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { TransactionService } from '@new-hros/libs-sql';
import { RequestContextService } from '@new-hros/libs-core';
import { OutboxEventRepository } from '../../src/modules/company/repositories/outbox-event.repository';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { JobTitle } from '@new-hros/libs-sql';
import { Department } from '@new-hros/libs-sql';
import { Grade } from '@new-hros/libs-sql';
import { CompanySetupStepEntity } from '../../src/modules/company/entities/company-setup-step.entity';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';

describe('JobTitleService - Create Job Title [US1]', () => {
  let service: JobTitleService;
  let mockJobTitleRepo: jest.Mocked<Partial<JobTitleRepository>>;
  let mockDepartmentRepo: jest.Mocked<Partial<DepartmentRepository>>;
  let mockGradeRepo: jest.Mocked<Partial<GradeRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockSetupStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockOutboxRepo: jest.Mocked<Partial<OutboxEventRepository>>;

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-1',
      employee: { companyId: 'comp-1' },
    } as unknown as ReturnType<typeof RequestContextService.getUser>);
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-1' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation(async (dto) => ({ id: 'outbox-1', ...dto })),
    };

    mockJobTitleRepo = {
      findByCode: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(async (data) => ({ id: 'job-title-1', ...data }) as JobTitle),
    };

    mockDepartmentRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'dept-1',
        name: 'Engineering',
        tenantCode: 'tenant-1',
        companyId: 'comp-1',
        status: MasterDataStatus.ACTIVE,
      } as unknown as Department),
    };

    mockGradeRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'grade-1',
        name: 'L3',
        tenantCode: 'tenant-1',
        companyId: 'comp-1',
        status: MasterDataStatus.ACTIVE,
      } as unknown as Grade),
    };

    mockCompanyRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'comp-1',
        timezone: 'UTC',
      } as unknown as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as CompanySetupStepEntity),
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation(async (cb) => cb()),
    };

    service = new JobTitleService(
      mockTxService as unknown as TransactionService,
      mockOutboxRepo as unknown as OutboxEventRepository,
      mockJobTitleRepo as unknown as JobTitleRepository,
      mockDepartmentRepo as unknown as DepartmentRepository,
      mockGradeRepo as unknown as GradeRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      {} as unknown as EffectiveChangeRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject if effectiveAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    await expect(
      service.create(
        {
          code: 'SWE',
          name: 'Software Engineer',
          departmentId: 'dept-1',
          gradeId: 'grade-1',
          effectiveAt: pastDate,
        },
        'comp-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject if job title code already exists in company', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockJobTitleRepo.findByCode as jest.Mock).mockResolvedValue({
      id: 'existing-jt',
    } as JobTitle);

    await expect(
      service.create(
        {
          code: 'SWE',
          name: 'Software Engineer',
          departmentId: 'dept-1',
          gradeId: 'grade-1',
          effectiveAt: futureDate,
        },
        'comp-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject if department does not belong to company or is inactive (ADR-14)', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.create(
        {
          code: 'SWE',
          name: 'Software Engineer',
          departmentId: 'dept-diff-comp',
          gradeId: 'grade-1',
          effectiveAt: futureDate,
        },
        'comp-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject if grade does not belong to company or is inactive (ADR-14)', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockGradeRepo.findById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.create(
        {
          code: 'SWE',
          name: 'Software Engineer',
          departmentId: 'dept-1',
          gradeId: 'grade-diff-comp',
          effectiveAt: futureDate,
        },
        'comp-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should successfully create job title in scheduled status and complete setup step 5', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();

    const result = await service.create(
      {
        code: 'SWE',
        name: 'Software Engineer',
        departmentId: 'dept-1',
        gradeId: 'grade-1',
        description: 'Core engineering role',
        effectiveAt: futureDate,
      },
      'comp-1',
    );

    expect(result.id).toBe('job-title-1');
    expect(result.code).toBe('SWE');
    expect(result.status).toBe(MasterDataStatus.SCHEDULED);
    expect(mockSetupStepRepo.markStepCompleted).toHaveBeenCalledWith({
      companyId: 'comp-1',
      stepType: SetupStepType.JOB_TITLE,
      completedBy: 'user-1',
    });
    expect(mockOutboxRepo.create).toHaveBeenCalled();
  });
});
