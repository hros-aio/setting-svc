import { RequestContextService } from '@new-hros/libs-core';
import { JobTitle, TransactionService } from '@new-hros/libs-sql';
import { EntityManager, Repository } from 'typeorm';
import { MasterDataStatus } from '../../src/enums';
import { JobTitleRepository } from '../../src/modules/job-title/repositories/job-title.repository';

describe('JobTitleRepository', () => {
  let repository: JobTitleRepository;
  let mockTypeOrmRepo: jest.Mocked<Partial<Repository<JobTitle>>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockManager: jest.Mocked<Partial<EntityManager>>;

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');

    mockTypeOrmRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto as JobTitle),
      save: jest
        .fn()
        .mockImplementation(async (entity) => ({ id: 'job-title-1', ...entity }) as JobTitle),
    };

    mockManager = {
      getRepository: jest.fn().mockReturnValue(mockTypeOrmRepo as unknown as Repository<JobTitle>),
    };

    mockTxService = {
      getManager: jest.fn().mockReturnValue(mockManager as unknown as EntityManager),
    };

    repository = new JobTitleRepository(mockTxService as unknown as TransactionService);
    jest
      .spyOn(repository as unknown as { tenantCode: string }, 'tenantCode', 'get')
      .mockReturnValue('tenant-1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should find job title by ID with relations', async () => {
    const mockJobTitle = {
      id: 'job-title-1',
      name: 'Software Engineer',
      code: 'SWE',
      tenantCode: 'tenant-1',
    } as JobTitle;
    (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockJobTitle);

    const result = await repository.findByIdWithRelations('job-title-1');
    expect(result).toBe(mockJobTitle);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'job-title-1', tenantCode: 'tenant-1' },
      relations: ['department', 'grade', 'sourceJobTitle'],
    });
  });

  it('should find job title by code within company', async () => {
    const mockJobTitle = { id: 'job-title-1', code: 'SWE', tenantCode: 'tenant-1' } as JobTitle;
    (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockJobTitle);

    const result = await repository.findByCode('comp-1', 'SWE');
    expect(result).toBe(mockJobTitle);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { tenantCode: 'tenant-1', companyId: 'comp-1', code: 'SWE' },
      relations: ['department', 'grade'],
    });
  });

  it('should find job titles using BaseRepository find with pagination, filters, and search', async () => {
    const mockJobTitles = [
      {
        id: 'job-title-1',
        code: 'SWE',
        name: 'Software Engineer',
        departmentId: 'dept-1',
        gradeId: 'grade-1',
        status: MasterDataStatus.ACTIVE,
        tenantCode: 'tenant-1',
      },
    ] as JobTitle[];
    (mockTypeOrmRepo.findAndCount as jest.Mock).mockResolvedValue([mockJobTitles, 1]);

    const result = await repository.findJobTitles(
      'comp-1',
      { page: 1, limit: 10 },
      'Engineer',
      'active',
      'dept-1',
      'grade-1',
    );
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(mockTypeOrmRepo.findAndCount).toHaveBeenCalled();
  });

  it('should return true when active or scheduled job title exists', async () => {
    (mockTypeOrmRepo.count as jest.Mock).mockResolvedValue(1);

    const result = await repository.hasActiveOrScheduled('comp-1');
    expect(result).toBe(true);
    expect(mockTypeOrmRepo.count).toHaveBeenCalled();
  });

  it('should create and save job title entity', async () => {
    const data = { name: 'Software Engineer', code: 'SWE' };
    const saved = await repository.create(data);
    expect(saved.id).toBe('job-title-1');
    expect(saved.name).toBe('Software Engineer');
    expect(saved.tenantCode).toBe('tenant-1');
  });
});
