import { GradeRepository } from '../../src/modules/grade/repositories/grade.repository';
import { GradeEntity } from '../../src/modules/grade/entities/grade.entity';
import { MasterDataStatus } from '../../src/enums';
import { DataSource, Repository } from 'typeorm';

describe('GradeRepository', () => {
  let repository: GradeRepository;
  let mockTypeOrmRepo: jest.Mocked<Partial<Repository<GradeEntity>>>;

  beforeEach(() => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((dto) => dto as GradeEntity),
      save: jest
        .fn()
        .mockImplementation(async (entity) => ({ id: 'grade-1', ...entity }) as GradeEntity),
    };

    repository = new GradeRepository(
      mockTypeOrmRepo as unknown as Repository<GradeEntity>,
      {} as unknown as DataSource,
    );
  });

  it('should find grade by ID and company', async () => {
    const mockGrade = { id: 'grade-1', name: 'L3', code: 'L3' } as GradeEntity;
    (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockGrade);

    const result = await repository.findById('tenant-1', 'comp-1', 'grade-1');
    expect(result).toBe(mockGrade);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'grade-1', tenantId: 'tenant-1', companyId: 'comp-1' },
      relations: ['sourceGrade'],
    });
  });

  it('should find grade by code within company', async () => {
    const mockGrade = { id: 'grade-1', code: 'L3' } as GradeEntity;
    (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockGrade);

    const result = await repository.findByCode('tenant-1', 'comp-1', 'L3');
    expect(result).toBe(mockGrade);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', companyId: 'comp-1', code: 'L3' },
    });
  });

  it('should find grades using TypeORM findAndCount with pagination and search', async () => {
    const mockGrades = [
      { id: 'grade-1', code: 'L3', name: 'Senior Engineer', status: MasterDataStatus.ACTIVE },
    ] as GradeEntity[];
    (mockTypeOrmRepo.findAndCount as jest.Mock).mockResolvedValue([mockGrades, 1]);

    const result = await repository.find('tenant-1', 'comp-1', {
      page: 1,
      limit: 10,
      search: 'Senior',
      status: 'active',
    });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
    expect(mockTypeOrmRepo.findAndCount).toHaveBeenCalled();
  });

  it('should return true when active or scheduled grade exists using TypeORM count', async () => {
    (mockTypeOrmRepo.count as jest.Mock).mockResolvedValue(1);

    const result = await repository.hasActiveOrScheduled('tenant-1', 'comp-1');
    expect(result).toBe(true);
    expect(mockTypeOrmRepo.count).toHaveBeenCalled();
  });
});
