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
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';

describe('JobTitleService - Schedule Job Title Deactivation [US4]', () => {
  let service: JobTitleService;
  let mockJobTitleRepo: jest.Mocked<Partial<JobTitleRepository>>;
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
      {} as unknown as DepartmentRepository,
      {} as unknown as GradeRepository,
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
      service.scheduleDeactivation('invalid-id', { effectiveAt: futureDate }, 'comp-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject if job title is already inactive', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockJobTitleRepo.findById as jest.Mock).mockResolvedValue({
      id: 'job-title-1',
      status: MasterDataStatus.INACTIVE,
    } as JobTitle);

    await expect(
      service.scheduleDeactivation('job-title-1', { effectiveAt: futureDate }, 'comp-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject if pending change exists on job title', async () => {
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
      service.scheduleDeactivation('job-title-1', { effectiveAt: futureDate }, 'comp-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('should successfully schedule deactivation in effective_changes and emit outbox event', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    const mockJobTitle = {
      id: 'job-title-1',
      code: 'SWE',
      name: 'Software Engineer',
      status: MasterDataStatus.ACTIVE,
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    } as JobTitle;

    (mockJobTitleRepo.findById as jest.Mock).mockResolvedValue(mockJobTitle);

    const result = await service.scheduleDeactivation(
      'job-title-1',
      { effectiveAt: futureDate },
      'comp-1',
    );

    expect(result.id).toBe('change-1');
    expect(result.operation).toBe(ChangeOperation.DEACTIVATE);
    expect(result.status).toBe(EffectiveChangeStatus.SCHEDULED);
    expect(mockOutboxRepo.create).toHaveBeenCalled();
  });
});
