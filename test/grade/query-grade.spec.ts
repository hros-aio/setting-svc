import { NotFoundException } from '@nestjs/common';
import { GradeQueryService } from '../../src/modules/grade/services/grade-query.service';
import { GradeRepository } from '../../src/modules/grade/repositories/grade.repository';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';
import { Grade } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { ChangeOperation, EffectiveChangeStatus, MasterDataStatus } from '../../src/enums';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';

describe('GradeQueryService - Query Grades [US2]', () => {
  let queryService: GradeQueryService;
  let mockGradeRepo: jest.Mocked<Partial<GradeRepository>>;
  let mockEffectiveChangeRepo: jest.Mocked<Partial<EffectiveChangeRepository>>;

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    sessionId: 'sess-1',
    tenantCode: 'tenant-1',
    roles: ['admin'],
    scopes: [],
    permissions: ['grade:read'],
  };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-1' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockGradeRepo = {
      find: jest.fn().mockResolvedValue({
        data: [{ id: 'grade-1', code: 'L3', status: MasterDataStatus.ACTIVE } as Grade],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      }),
      findById: jest.fn(),
    };

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn().mockResolvedValue(null),
    };

    queryService = new GradeQueryService(
      mockGradeRepo as unknown as GradeRepository,
      mockEffectiveChangeRepo as unknown as EffectiveChangeRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return active grades for current company by default', async () => {
    const result = await queryService.find({ page: 1, limit: 10 }, mockAuthContext);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('grade-1');
    expect(mockGradeRepo.find).toHaveBeenCalledWith('tenant-1', 'comp-1', {
      page: 1,
      limit: 10,
      search: undefined,
      status: undefined,
    });
  });

  it('should return all grades when querying with status filter', async () => {
    const result = await queryService.find({ status: 'all' }, mockAuthContext);
    expect(result.data).toHaveLength(1);
    expect(mockGradeRepo.find).toHaveBeenCalledWith('tenant-1', 'comp-1', {
      page: 1,
      limit: 20,
      search: undefined,
      status: 'all',
    });
  });

  it('should throw NotFoundException if grade does not exist', async () => {
    (mockGradeRepo.findById as jest.Mock).mockResolvedValue(null);

    await expect(queryService.findById('invalid-id', mockAuthContext)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return grade with pending change details if scheduled change exists', async () => {
    const mockGrade = {
      id: 'grade-1',
      code: 'L3',
      name: 'Senior Software Engineer',
      status: MasterDataStatus.ACTIVE,
    } as Grade;

    const mockPending = {
      id: 'change-1',
      operation: ChangeOperation.UPDATE,
      status: EffectiveChangeStatus.SCHEDULED,
      effectiveAt: new Date('2026-08-30T00:00:00.000Z'),
      payload: { name: 'Lead Senior Software Engineer' },
    } as unknown as EffectiveChangeEntity;

    (mockGradeRepo.findById as jest.Mock).mockResolvedValue(mockGrade);
    (mockEffectiveChangeRepo.findPendingChange as jest.Mock).mockResolvedValue(mockPending);

    const result = await queryService.findById('grade-1', mockAuthContext);
    expect(result.id).toBe('grade-1');
    expect(result.pendingChange).toBeDefined();
    expect(result.pendingChange?.changeId).toBe('change-1');
    expect(result.pendingChange?.action).toBe('UPDATE');
  });
});
