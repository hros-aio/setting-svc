import { RequestContextService } from '@new-hros/libs-core';
import { Grade, TransactionService } from '@new-hros/libs-sql';
import { EntityManager, Repository } from 'typeorm';
import { MasterDataStatus } from '../../src/enums';
import { GradeRepository } from '../../src/modules/grade/repositories/grade.repository';

describe('GradeRepository', () => {
  let repository: GradeRepository;
  let mockTypeOrmRepo: jest.Mocked<Partial<Repository<Grade>>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockManager: jest.Mocked<Partial<EntityManager>>;

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');

    mockTypeOrmRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((dto) => dto as Grade),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'grade-1', ...entity }) as Grade),
    };

    mockManager = {
      getRepository: jest.fn().mockReturnValue(mockTypeOrmRepo as unknown as Repository<Grade>),
    };

    mockTxService = {
      getManager: jest.fn().mockReturnValue(mockManager as unknown as EntityManager),
    };

    repository = new GradeRepository(mockTxService as unknown as TransactionService);
    jest
      .spyOn(repository as unknown as { tenantCode: string }, 'tenantCode', 'get')
      .mockReturnValue('tenant-1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should find grade by ID and relations', async () => {
    const mockGrade = { id: 'grade-1', name: 'L3', code: 'L3', tenantCode: 'tenant-1' } as Grade;
    (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockGrade);

    const result = await repository.findByIdWithSource('grade-1');
    expect(result).toBe(mockGrade);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'grade-1', tenantCode: 'tenant-1' },
      relations: ['sourceGrade'],
    });
  });

  it('should find grade by code within company', async () => {
    const mockGrade = { id: 'grade-1', code: 'L3', tenantCode: 'tenant-1' } as Grade;
    (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockGrade);

    const result = await repository.findByCode('comp-1', 'L3');
    expect(result).toBe(mockGrade);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { tenantCode: 'tenant-1', companyId: 'comp-1', code: 'L3' },
    });
  });

  it('should find grades using TypeORM findAndCount with pagination and search', async () => {
    const mockGrades = [
      {
        id: 'grade-1',
        code: 'L3',
        name: 'Senior Engineer',
        status: MasterDataStatus.ACTIVE,
        tenantCode: 'tenant-1',
      },
    ] as Grade[];
    (mockTypeOrmRepo.findAndCount as jest.Mock).mockResolvedValue([mockGrades, 1]);

    const result = await repository.findGrades(
      'comp-1',
      {
        page: 1,
        limit: 10,
      },
      'Senior',
      'active',
    );
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(mockTypeOrmRepo.findAndCount).toHaveBeenCalled();
  });

  it('should return true when active or scheduled grade exists using TypeORM count', async () => {
    (mockTypeOrmRepo.count as jest.Mock).mockResolvedValue(1);

    const result = await repository.hasActiveOrScheduled('comp-1');
    expect(result).toBe(true);
    expect(mockTypeOrmRepo.count).toHaveBeenCalled();
  });
});
