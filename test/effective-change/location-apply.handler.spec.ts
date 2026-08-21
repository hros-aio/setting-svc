import { LocationApplyHandler } from '../../src/modules/effective-change/handlers/location-apply.handler';
import { Location } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { EffectiveChangeStatus, LocationEventType, MasterDataStatus } from '../../src/enums';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';

describe('LocationApplyHandler [US5]', () => {
  let handler: LocationApplyHandler;
  let mockLocationRepo: jest.Mocked<Partial<Repository<Location>>>;
  let mockChangeRepo: jest.Mocked<Partial<Repository<EffectiveChangeEntity>>>;
  let mockOutboxRepo: jest.Mocked<Partial<Repository<OutboxEventEntity>>>;
  let mockEm: jest.Mocked<Partial<EntityManager>>;
  let mockDataSource: jest.Mocked<Partial<DataSource>>;

  beforeEach(() => {
    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => dto as OutboxEventEntity),
      save: jest.fn().mockResolvedValue({ id: 'outbox-1' } as OutboxEventEntity),
    };

    mockLocationRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (loc) => loc as Location),
    };

    mockChangeRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (chg) => chg as EffectiveChangeEntity),
    };

    mockEm = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === Location || entity.name === 'Location') {
          return mockLocationRepo as unknown as Repository<Location>;
        }
        if (entity === EffectiveChangeEntity || entity.name === 'EffectiveChangeEntity') {
          return mockChangeRepo as unknown as Repository<EffectiveChangeEntity>;
        }
        return mockOutboxRepo as unknown as Repository<OutboxEventEntity>;
      }),
    };

    mockDataSource = {
      manager: mockEm as EntityManager,
    };

    handler = new LocationApplyHandler(mockDataSource as unknown as DataSource);
  });

  it('should transition scheduled location to active on CREATE', async () => {
    const mockLocation = {
      id: 'loc-1',
      tenantId: 'tenant-1',
      companyId: 'comp-1',
      status: MasterDataStatus.SCHEDULED,
      code: 'HQ-TYO',
      name: 'Tokyo HQ',
    } as unknown as Location;
    (mockLocationRepo.findOne as jest.Mock).mockResolvedValue(mockLocation);

    await handler.apply(
      {
        changeId: 'loc-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        entityType: 'location',
        operation: 'CREATE',
      },
      mockEm as EntityManager,
    );

    expect(mockLocation.status).toBe(MasterDataStatus.ACTIVE);
    expect(mockLocationRepo.save).toHaveBeenCalledWith(mockLocation);
    expect(mockOutboxRepo.save).toHaveBeenCalled();
  });

  it('should mark applied and publish event without mutating location on UPDATE', async () => {
    const mockChange = {
      id: 'chg-1',
      entityId: 'loc-1',
      tenantId: 'tenant-1',
      companyId: 'comp-1',
      status: EffectiveChangeStatus.SCHEDULED,
      payload: { name: 'Updated Tokyo Office' },
      expectedUpdatedAt: new Date('2026-08-16T00:00:00Z'),
    } as unknown as EffectiveChangeEntity;
    const mockLocation = {
      id: 'loc-1',
      name: 'Tokyo Office',
      updatedAt: new Date('2026-08-16T00:00:00Z'),
    } as unknown as Location;

    (mockChangeRepo.findOne as jest.Mock).mockResolvedValue(mockChange);
    (mockLocationRepo.findOne as jest.Mock).mockResolvedValue(mockLocation);

    await handler.apply(
      {
        changeId: 'chg-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        entityType: 'location',
        operation: 'UPDATE',
      },
      mockEm as EntityManager,
    );

    expect(mockLocationRepo.save).not.toHaveBeenCalled();
    expect(mockChange.status).toBe(EffectiveChangeStatus.APPLIED);
    expect(mockOutboxRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: LocationEventType.LOCATION_UPDATED,
      }),
    );
  });

  it('should deactivate location on DEACTIVATE operation', async () => {
    const mockChange = {
      id: 'chg-1',
      entityId: 'loc-1',
      tenantId: 'tenant-1',
      companyId: 'comp-1',
      status: EffectiveChangeStatus.SCHEDULED,
      expectedUpdatedAt: new Date('2026-08-16T00:00:00Z'),
    } as unknown as EffectiveChangeEntity;
    const mockLocation = {
      id: 'loc-1',
      status: MasterDataStatus.ACTIVE,
      updatedAt: new Date('2026-08-16T00:00:00Z'),
    } as unknown as Location;

    (mockChangeRepo.findOne as jest.Mock).mockResolvedValue(mockChange);
    (mockLocationRepo.findOne as jest.Mock).mockResolvedValue(mockLocation);

    await handler.apply(
      {
        changeId: 'chg-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        entityType: 'location',
        operation: 'DEACTIVATE',
      },
      mockEm as EntityManager,
    );

    expect(mockLocation.status).toBe(MasterDataStatus.INACTIVE);
    expect(mockChange.status).toBe(EffectiveChangeStatus.APPLIED);
    expect(mockOutboxRepo.save).toHaveBeenCalled();
  });
});
