import { BadRequestException, ConflictException } from '@nestjs/common';
import { JobTitleService } from '../../src/modules/job-title/services/job-title.service';
import { MasterDataStatus, SetupStepType } from '../../src/enums';
import { JobTitleRepository } from '../../src/modules/job-title/repositories/job-title.repository';
import { DepartmentRepository } from '../../src/modules/department/repositories/department.repository';
import { GradeRepository } from '../../src/modules/grade/repositories/grade.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
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
  let mockDataSource: jest.Mocked<Partial<DataSource>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockOutboxRepo: jest.Mocked<Partial<Repository<OutboxEventEntity>>>;

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    sessionId: 'sess-1',
    tenantCode: 'tenant-1',
    roles: ['admin'],
    scopes: [],
    permissions: ['job-title:create'],
  };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-1' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => dto as OutboxEventEntity),
      save: jest.fn().mockResolvedValue({ id: 'outbox-1' } as OutboxEventEntity),
    };

    mockJobTitleRepo = {
      findByCode: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      createAndSave: jest
        .fn()
        .mockImplementation((data) => ({ id: 'job-title-1', ...data }) as JobTitle),
    };

    mockDepartmentRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'dept-1',
        name: 'Engineering',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        status: MasterDataStatus.ACTIVE,
      } as Department),
    };

    mockGradeRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'grade-1',
        name: 'L3',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        status: MasterDataStatus.ACTIVE,
      } as Grade),
    };

    mockCompanyRepo = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-1',
        timezone: 'UTC',
      } as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as CompanySetupStepEntity),
    };

    const mockManager: Partial<EntityManager> = {
      getRepository: jest
        .fn()
        .mockReturnValue(mockOutboxRepo as unknown as Repository<OutboxEventEntity>),
    };

    mockDataSource = {
      manager: mockManager as EntityManager,
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation(async (cb) => cb()),
    };

    service = new JobTitleService(
      mockDataSource as unknown as DataSource,
      mockTxService as unknown as TransactionService,
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
        mockAuthContext,
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
        mockAuthContext,
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
        mockAuthContext,
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
        mockAuthContext,
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
      mockAuthContext,
    );

    expect(result.id).toBe('job-title-1');
    expect(result.code).toBe('SWE');
    expect(result.status).toBe(MasterDataStatus.SCHEDULED);
    expect(mockSetupStepRepo.markStepCompleted).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      companyId: 'comp-1',
      stepType: SetupStepType.JOB_TITLE,
      completedBy: 'user-1',
      entityManager: mockDataSource.manager,
    });
    expect(mockOutboxRepo.save).toHaveBeenCalled();
  });
});
