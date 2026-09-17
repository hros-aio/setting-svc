import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JobTitleService } from '../../src/modules/job-title/services/job-title.service';
import { MasterDataStatus, ChangeOperation, EffectiveChangeStatus } from '../../src/enums';
import { JobTitleRepository } from '../../src/modules/job-title/repositories/job-title.repository';
import { DepartmentRepository } from '../../src/modules/department/repositories/department.repository';
import { GradeRepository } from '../../src/modules/grade/repositories/grade.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';
import { TransactionService } from '@new-hros/libs-sql';
import { RequestContextService } from '@new-hros/libs-core';
import { OutboxEventRepository } from '../../src/modules/company/repositories/outbox-event.repository';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { JobTitle } from '@new-hros/libs-sql';
import { Department } from '@new-hros/libs-sql';
import { Grade } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';

describe('JobTitleService - Schedule Job Title Update [US3]', () => {
  let service: JobTitleService;
  let mockJobTitleRepo: jest.Mocked<Partial<JobTitleRepository>>;
  let mockDepartmentRepo: jest.Mocked<Partial<DepartmentRepository>>;
  let mockGradeRepo: jest.Mocked<Partial<GradeRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockEffectiveChangeRepo: jest.Mocked<Partial<EffectiveChangeRepository>>;
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
      findById: jest.fn(),
      findByCode: jest.fn().mockResolvedValue(null),
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

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ id: 'change-1', ...data } as unknown as EffectiveChangeEntity),
        ),
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
      {} as unknown as CompanySetupStepRepository,
      mockEffectiveChangeRepo as unknown as EffectiveChangeRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject if job title not found', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockJobTitleRepo.findById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.scheduleUpdate(
        'invalid-id',
        { name: 'Updated Name', effectiveAt: futureDate },
        'comp-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject if job title is not active', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockJobTitleRepo.findById as jest.Mock).mockResolvedValue({
      id: 'job-title-1',
      status: MasterDataStatus.SCHEDULED,
    } as JobTitle);

    await expect(
      service.scheduleUpdate(
        'job-title-1',
        { name: 'Updated Name', effectiveAt: futureDate },
        'comp-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject if a pending change already exists (enforcing BR-13 / INV-007)', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockJobTitleRepo.findById as jest.Mock).mockResolvedValue({
      id: 'job-title-1',
      status: MasterDataStatus.ACTIVE,
    } as JobTitle);
    (mockEffectiveChangeRepo.findPendingChange as jest.Mock).mockResolvedValue({
      id: 'existing-change',
      status: EffectiveChangeStatus.SCHEDULED,
    } as EffectiveChangeEntity);

    await expect(
      service.scheduleUpdate(
        'job-title-1',
        { name: 'Updated Name', effectiveAt: futureDate },
        'comp-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject if updated department does not belong to company or is inactive (ADR-14)', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockJobTitleRepo.findById as jest.Mock).mockResolvedValue({
      id: 'job-title-1',
      status: MasterDataStatus.ACTIVE,
    } as JobTitle);
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.scheduleUpdate(
        'job-title-1',
        { departmentId: 'dept-other-comp', effectiveAt: futureDate },
        'comp-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should successfully schedule update in effective_changes and emit outbox event', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    const mockJobTitle = {
      id: 'job-title-1',
      code: 'SWE',
      name: 'Software Engineer',
      departmentId: 'dept-1',
      gradeId: 'grade-1',
      status: MasterDataStatus.ACTIVE,
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    } as JobTitle;

    (mockJobTitleRepo.findById as jest.Mock).mockResolvedValue(mockJobTitle);

    const result = await service.scheduleUpdate(
      'job-title-1',
      { name: 'Senior Software Engineer', effectiveAt: futureDate },
      'comp-1',
    );

    expect(result.id).toBe('change-1');
    expect(result.operation).toBe(ChangeOperation.UPDATE);
    expect(result.status).toBe(EffectiveChangeStatus.SCHEDULED);
    expect(result.payload).toEqual({
      name: 'Senior Software Engineer',
    });
    expect(mockOutboxRepo.create).toHaveBeenCalled();
  });
});
