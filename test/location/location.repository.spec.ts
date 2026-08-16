import { LocationRepository } from '../../src/modules/location/repositories/location.repository';
import { LocationEntity } from '../../src/modules/location/entities/location.entity';
import { MasterDataStatus } from '../../src/enums';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

describe('LocationRepository', () => {
  let repository: LocationRepository;
  let mockTypeOrmRepo: jest.Mocked<Partial<Repository<LocationEntity>>>;
  let mockQueryBuilder: jest.Mocked<Partial<SelectQueryBuilder<LocationEntity>>>;

  beforeEach(() => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getCount: jest.fn().mockResolvedValue(0),
    };

    mockTypeOrmRepo = {
      findOne: jest.fn(),
      count: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto as LocationEntity),
      save: jest
        .fn()
        .mockImplementation(async (entity) => ({ id: 'loc-1', ...entity }) as LocationEntity),
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(mockQueryBuilder as unknown as SelectQueryBuilder<LocationEntity>),
    };

    repository = new LocationRepository(
      mockTypeOrmRepo as unknown as Repository<LocationEntity>,
      {} as unknown as DataSource,
    );
  });

  it('should find location by ID and company', async () => {
    const mockLocation = { id: 'loc-1', name: 'HQ' } as LocationEntity;
    (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockLocation);

    const result = await repository.findById('tenant-1', 'comp-1', 'loc-1');
    expect(result).toBe(mockLocation);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'loc-1', tenantId: 'tenant-1', companyId: 'comp-1' },
    });
  });

  it('should find active locations with pagination', async () => {
    const mockLocations = [
      { id: 'loc-1', name: 'HQ', status: MasterDataStatus.ACTIVE },
    ] as LocationEntity[];
    (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([mockLocations, 1]);

    const result = await repository.findActiveLocations('tenant-1', 'comp-1', {
      page: 1,
      limit: 10,
    });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });

  it('should check if company has active headquarter', async () => {
    (mockTypeOrmRepo.count as jest.Mock).mockResolvedValue(1);

    const exists = await repository.hasActiveOrScheduledHeadquarter('tenant-1', 'comp-1');
    expect(exists).toBe(true);
    expect(mockTypeOrmRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          companyId: 'comp-1',
          isHeadquarter: true,
        }),
      }),
    );
  });

  it('should create and save location entity', async () => {
    const data = { name: 'Tokyo Office', code: 'HQ-TYO' };
    const saved = await repository.createAndSave(data);
    expect(saved.id).toBe('loc-1');
    expect(saved.name).toBe('Tokyo Office');
  });
});
