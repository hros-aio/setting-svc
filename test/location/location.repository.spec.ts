import { RequestContextService } from '@new-hros/libs-core';
import { Location, TransactionService } from '@new-hros/libs-sql';
import { EntityManager, Repository } from 'typeorm';
import { MasterDataStatus } from '../../src/enums';
import { LocationRepository } from '../../src/modules/location/repositories/location.repository';

describe('LocationRepository', () => {
  let repository: LocationRepository;
  let mockTypeOrmRepo: jest.Mocked<Partial<Repository<Location>>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockManager: jest.Mocked<Partial<EntityManager>>;

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');

    mockTypeOrmRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto as Location),
      save: jest
        .fn()
        .mockImplementation(async (entity) => ({ id: 'loc-1', ...entity }) as Location),
    };

    mockManager = {
      getRepository: jest.fn().mockReturnValue(mockTypeOrmRepo as unknown as Repository<Location>),
    };

    mockTxService = {
      getManager: jest.fn().mockReturnValue(mockManager as unknown as EntityManager),
    };

    repository = new LocationRepository(mockTxService as unknown as TransactionService);
    jest
      .spyOn(repository as unknown as { tenantCode: string }, 'tenantCode', 'get')
      .mockReturnValue('tenant-1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should find location by ID', async () => {
    const mockLocation = { id: 'loc-1', name: 'HQ', tenantCode: 'tenant-1' } as Location;
    (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockLocation);

    const result = await repository.findById('loc-1');
    expect(result).toBe(mockLocation);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'loc-1', tenantCode: 'tenant-1' },
    });
  });

  it('should find active locations with pagination', async () => {
    const mockLocations = [
      { id: 'loc-1', name: 'HQ', status: MasterDataStatus.ACTIVE, tenantCode: 'tenant-1' },
    ] as Location[];
    (mockTypeOrmRepo.findAndCount as jest.Mock).mockResolvedValue([mockLocations, 1]);

    const result = await repository.findActive('comp-1', {
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

  it('should check if company has active headquarter', async () => {
    (mockTypeOrmRepo.count as jest.Mock).mockResolvedValue(1);

    const exists = await repository.hasActiveOrScheduledHeadquarter('comp-1');
    expect(exists).toBe(true);
    expect(mockTypeOrmRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantCode: 'tenant-1',
          companyId: 'comp-1',
          isHeadquarter: true,
        }),
      }),
    );
  });

  it('should create and save location entity', async () => {
    const data = { name: 'Tokyo Office', code: 'HQ-TYO' };
    const saved = await repository.create(data);
    expect(saved.id).toBe('loc-1');
    expect(saved.name).toBe('Tokyo Office');
    expect(saved.tenantCode).toBe('tenant-1');
  });
});
