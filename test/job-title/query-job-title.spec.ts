import { NotFoundException } from '@nestjs/common';
import { JobTitleQueryService } from '../../src/modules/job-title/services/job-title-query.service';
import { JobTitleRepository } from '../../src/modules/job-title/repositories/job-title.repository';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';
import { JobTitle } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { ChangeOperation, EffectiveChangeStatus, MasterDataStatus } from '../../src/enums';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';

describe('JobTitleQueryService - Query Job Titles [US2]', () => {
  let queryService: JobTitleQueryService;
  let mockJobTitleRepo: jest.Mocked<Partial<JobTitleRepository>>;
  let mockEffectiveChangeRepo: jest.Mocked<Partial<EffectiveChangeRepository>>;

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    sessionId: 'sess-1',
    tenantCode: 'tenant-1',
    roles: ['admin'],
    scopes: [],
    permissions: ['job-title:read'],
  };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-1' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockJobTitleRepo = {
      find: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'job-title-1',
            code: 'SWE',
            status: MasterDataStatus.ACTIVE,
            departmentId: 'dept-1',
            gradeId: 'grade-1',
          } as JobTitle,
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      }),
      findById: jest.fn(),
    };

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn().mockResolvedValue(null),
    };

    queryService = new JobTitleQueryService(
      mockJobTitleRepo as unknown as JobTitleRepository,
      mockEffectiveChangeRepo as unknown as EffectiveChangeRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return active job titles for current company by default', async () => {
    const result = await queryService.find({ page: 1, limit: 10 }, mockAuthContext);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('job-title-1');
    expect(mockJobTitleRepo.find).toHaveBeenCalledWith('tenant-1', 'comp-1', {
      page: 1,
      limit: 10,
      search: undefined,
      status: undefined,
      departmentId: undefined,
      gradeId: undefined,
    });
  });

  it('should return all job titles when querying with status and department filter', async () => {
    const result = await queryService.find(
      { status: 'all', departmentId: 'dept-1' },
      mockAuthContext,
    );
    expect(result.data).toHaveLength(1);
    expect(mockJobTitleRepo.find).toHaveBeenCalledWith('tenant-1', 'comp-1', {
      page: 1,
      limit: 20,
      search: undefined,
      status: 'all',
      departmentId: 'dept-1',
      gradeId: undefined,
    });
  });

  it('should throw NotFoundException if job title does not exist', async () => {
    (mockJobTitleRepo.findById as jest.Mock).mockResolvedValue(null);

    await expect(queryService.findById('invalid-id', mockAuthContext)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return job title with pending change details if scheduled change exists', async () => {
    const mockJobTitle = {
      id: 'job-title-1',
      code: 'SWE',
      name: 'Software Engineer',
      status: MasterDataStatus.ACTIVE,
    } as JobTitle;

    const mockPending = {
      id: 'change-1',
      operation: ChangeOperation.UPDATE,
      status: EffectiveChangeStatus.SCHEDULED,
      effectiveAt: new Date('2026-08-30T00:00:00.000Z'),
      payload: { name: 'Senior Software Engineer' },
    } as unknown as EffectiveChangeEntity;

    (mockJobTitleRepo.findById as jest.Mock).mockResolvedValue(mockJobTitle);
    (mockEffectiveChangeRepo.findPendingChange as jest.Mock).mockResolvedValue(mockPending);

    const result = await queryService.findById('job-title-1', mockAuthContext);
    expect(result.id).toBe('job-title-1');
    expect(result.pendingChange).toBeDefined();
    expect(result.pendingChange?.changeId).toBe('change-1');
    expect(result.pendingChange?.action).toBe('UPDATE');
  });
});
