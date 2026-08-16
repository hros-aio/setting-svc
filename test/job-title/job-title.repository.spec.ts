import { JobTitleRepository } from '../../src/modules/job-title/repositories/job-title.repository';
import { JobTitleEntity } from '../../src/modules/job-title/entities/job-title.entity';
import { MasterDataStatus } from '../../src/enums';
import { DataSource, Repository } from 'typeorm';

describe('JobTitleRepository', () => {
  let repository: JobTitleRepository;
  let mockTypeOrmRepo: jest.Mocked<Partial<Repository<JobTitleEntity>>>;

  beforeEach(() => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((dto) => dto as JobTitleEntity),
      save: jest
        .fn()
        .mockImplementation(async (entity) => ({ id: 'job-title-1', ...entity }) as JobTitleEntity),
    };

    repository = new JobTitleRepository(
      mockTypeOrmRepo as unknown as Repository<JobTitleEntity>,
      {} as unknown as DataSource,
    );
  });

  it('should find job title by ID and company', async () => {
    const mockJobTitle = {
      id: 'job-title-1',
      name: 'Software Engineer',
      code: 'SWE',
    } as JobTitleEntity;
    (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockJobTitle);

    const result = await repository.findById('tenant-1', 'comp-1', 'job-title-1');
    expect(result).toBe(mockJobTitle);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'job-title-1', tenantId: 'tenant-1', companyId: 'comp-1' },
      relations: ['department', 'grade', 'sourceJobTitle'],
    });
  });

  it('should find job title by code within company', async () => {
    const mockJobTitle = { id: 'job-title-1', code: 'SWE' } as JobTitleEntity;
    (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockJobTitle);

    const result = await repository.findByCode('tenant-1', 'comp-1', 'SWE');
    expect(result).toBe(mockJobTitle);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', companyId: 'comp-1', code: 'SWE' },
      relations: ['department', 'grade'],
    });
  });

  it('should find job titles using TypeORM findAndCount with pagination, filters, and search', async () => {
    const mockJobTitles = [
      {
        id: 'job-title-1',
        code: 'SWE',
        name: 'Software Engineer',
        departmentId: 'dept-1',
        gradeId: 'grade-1',
        status: MasterDataStatus.ACTIVE,
      },
    ] as JobTitleEntity[];
    (mockTypeOrmRepo.findAndCount as jest.Mock).mockResolvedValue([mockJobTitles, 1]);

    const result = await repository.find('tenant-1', 'comp-1', {
      page: 1,
      limit: 10,
      search: 'Engineer',
      status: 'active',
      departmentId: 'dept-1',
      gradeId: 'grade-1',
    });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
    expect(mockTypeOrmRepo.findAndCount).toHaveBeenCalled();
  });

  it('should return true when active or scheduled job title exists using TypeORM count', async () => {
    (mockTypeOrmRepo.count as jest.Mock).mockResolvedValue(1);

    const result = await repository.hasActiveOrScheduled('tenant-1', 'comp-1');
    expect(result).toBe(true);
    expect(mockTypeOrmRepo.count).toHaveBeenCalled();
  });
});
