import { DepartmentRepository } from '../../src/modules/department/repositories/department.repository';
import { Department } from '@new-hros/libs-sql';
import { MasterDataStatus } from '../../src/enums';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

describe('DepartmentRepository', () => {
  let repository: DepartmentRepository;
  let mockTypeOrmRepo: jest.Mocked<Partial<Repository<Department>>>;
  let mockQueryBuilder: jest.Mocked<Partial<SelectQueryBuilder<Department>>>;

  beforeEach(() => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getCount: jest.fn().mockResolvedValue(0),
    };

    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto as Department),
      save: jest
        .fn()
        .mockImplementation(async (entity) => ({ id: 'dept-1', ...entity }) as Department),
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(mockQueryBuilder as unknown as SelectQueryBuilder<Department>),
    };

    repository = new DepartmentRepository(
      mockTypeOrmRepo as unknown as Repository<Department>,
      {} as unknown as DataSource,
    );
  });

  it('should find department by ID and company', async () => {
    const mockDept = { id: 'dept-1', name: 'Engineering' } as Department;
    (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockDept);

    const result = await repository.findById('tenant-1', 'comp-1', 'dept-1');
    expect(result).toBe(mockDept);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'dept-1', tenantId: 'tenant-1', companyId: 'comp-1' },
      relations: ['parentDepartment'],
    });
  });

  it('should find active departments with pagination', async () => {
    const mockDepts = [
      { id: 'dept-1', name: 'Engineering', status: MasterDataStatus.ACTIVE },
    ] as Department[];
    (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([mockDepts, 1]);

    const result = await repository.findActiveDepartments('tenant-1', 'comp-1', {
      page: 1,
      limit: 10,
    });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });

  it('should construct hierarchical active tree', async () => {
    const depts = [
      {
        id: 'dept-root',
        name: 'Company HQ',
        parentDepartmentId: undefined,
        status: MasterDataStatus.ACTIVE,
      },
      {
        id: 'dept-eng',
        name: 'Engineering',
        parentDepartmentId: 'dept-root',
        status: MasterDataStatus.ACTIVE,
      },
      {
        id: 'dept-qa',
        name: 'QA',
        parentDepartmentId: 'dept-eng',
        status: MasterDataStatus.ACTIVE,
      },
    ] as Department[];
    (mockTypeOrmRepo.find as jest.Mock).mockResolvedValue(depts);

    const tree = await repository.findActiveDepartmentTree('tenant-1', 'comp-1');
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('dept-root');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('dept-eng');
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].id).toBe('dept-qa');
  });

  it('should traverse ancestor chain correctly', async () => {
    (mockTypeOrmRepo.findOne as jest.Mock)
      .mockResolvedValueOnce({
        id: 'dept-child',
        parentDepartmentId: 'dept-parent',
      } as Department)
      .mockResolvedValueOnce({
        id: 'dept-parent',
        parentDepartmentId: 'dept-root',
      } as Department)
      .mockResolvedValueOnce({
        id: 'dept-root',
        parentDepartmentId: undefined,
      } as Department);

    const chain = await repository.findAncestorChain('tenant-1', 'comp-1', 'dept-child');
    expect(chain).toEqual(['dept-child', 'dept-parent', 'dept-root']);
  });

  it('should detect cycles during ancestor chain traversal and break', async () => {
    (mockTypeOrmRepo.findOne as jest.Mock)
      .mockResolvedValueOnce({ id: 'dept-a', parentDepartmentId: 'dept-b' } as Department)
      .mockResolvedValueOnce({ id: 'dept-b', parentDepartmentId: 'dept-a' } as Department);

    const chain = await repository.findAncestorChain('tenant-1', 'comp-1', 'dept-a');
    expect(chain).toEqual(['dept-a', 'dept-b', 'dept-a']);
  });
});
