import { RequestContextService } from '@new-hros/libs-core';
import { Department, TransactionService } from '@new-hros/libs-sql';
import { EntityManager, Repository } from 'typeorm';
import { MasterDataStatus } from '../../src/enums';
import { DepartmentRepository } from '../../src/modules/department/repositories/department.repository';

describe('DepartmentRepository', () => {
  let repository: DepartmentRepository;
  let mockTypeOrmRepo: jest.Mocked<Partial<Repository<Department>>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockManager: jest.Mocked<Partial<EntityManager>>;

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');

    mockTypeOrmRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto as Department),
      save: jest
        .fn()
        .mockImplementation(async (entity) => ({ id: 'dept-1', ...entity }) as Department),
    };

    mockManager = {
      getRepository: jest.fn().mockReturnValue(mockTypeOrmRepo as unknown as Repository<Department>),
    };

    mockTxService = {
      getManager: jest.fn().mockReturnValue(mockManager as unknown as EntityManager),
    };

    repository = new DepartmentRepository(mockTxService as unknown as TransactionService);
    jest
      .spyOn(repository as unknown as { tenantCode: string }, 'tenantCode', 'get')
      .mockReturnValue('tenant-1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should find department by ID and relations', async () => {
    const mockDept = { id: 'dept-1', name: 'Engineering', tenantCode: 'tenant-1' } as Department;
    (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockDept);

    const result = await repository.findByIdWithParent('dept-1');
    expect(result).toBe(mockDept);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'dept-1', tenantCode: 'tenant-1' },
      relations: ['parentDepartment'],
    });
  });

  it('should find active departments with pagination', async () => {
    const mockDepts = [
      { id: 'dept-1', name: 'Engineering', status: MasterDataStatus.ACTIVE, tenantCode: 'tenant-1' },
    ] as Department[];
    (mockTypeOrmRepo.findAndCount as jest.Mock).mockResolvedValue([mockDepts, 1]);

    const result = await repository.findActiveDepartments('comp-1', {
      page: 1,
      limit: 10,
    });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(mockTypeOrmRepo.findAndCount).toHaveBeenCalledWith({
      where: {
        companyId: 'comp-1',
        status: MasterDataStatus.ACTIVE,
        tenantCode: 'tenant-1',
      },
      skip: 0,
      take: 10,
    });
  });

  it('should construct hierarchical active tree', async () => {
    const depts = [
      {
        id: 'dept-root',
        name: 'Company HQ',
        parentDepartmentId: undefined,
        status: MasterDataStatus.ACTIVE,
        tenantCode: 'tenant-1',
      },
      {
        id: 'dept-eng',
        name: 'Engineering',
        parentDepartmentId: 'dept-root',
        status: MasterDataStatus.ACTIVE,
        tenantCode: 'tenant-1',
      },
      {
        id: 'dept-qa',
        name: 'QA',
        parentDepartmentId: 'dept-eng',
        status: MasterDataStatus.ACTIVE,
        tenantCode: 'tenant-1',
      },
    ] as Department[];
    (mockTypeOrmRepo.find as jest.Mock).mockResolvedValue(depts);

    const tree = await repository.findActiveDepartmentTree('comp-1');
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
        tenantCode: 'tenant-1',
      } as Department)
      .mockResolvedValueOnce({
        id: 'dept-parent',
        parentDepartmentId: 'dept-root',
        tenantCode: 'tenant-1',
      } as Department)
      .mockResolvedValueOnce({
        id: 'dept-root',
        parentDepartmentId: undefined,
        tenantCode: 'tenant-1',
      } as Department);

    const chain = await repository.findAncestorChain('dept-child');
    expect(chain).toEqual(['dept-child', 'dept-parent', 'dept-root']);
  });

  it('should detect cycles during ancestor chain traversal and break', async () => {
    (mockTypeOrmRepo.findOne as jest.Mock)
      .mockResolvedValueOnce({
        id: 'dept-a',
        parentDepartmentId: 'dept-b',
        tenantCode: 'tenant-1',
      } as Department)
      .mockResolvedValueOnce({
        id: 'dept-b',
        parentDepartmentId: 'dept-a',
        tenantCode: 'tenant-1',
      } as Department);

    const chain = await repository.findAncestorChain('dept-a');
    expect(chain).toEqual(['dept-a', 'dept-b', 'dept-a']);
  });
});
