import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  AggregateType,
  EffectiveChangeStatus,
  MasterDataStatus,
  PocEventType,
  PocType,
} from '../../src/enums';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { EffectiveExecuteCommand } from '../../src/modules/effective-change/handlers/location-apply.handler';
import { PocApplyHandler } from '../../src/modules/effective-change/handlers/poc-apply.handler';
import { PocEntity } from '../../src/modules/poc/entities/poc.entity';

describe('PocApplyHandler', () => {
  let handler: PocApplyHandler;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockEntityManager: jest.Mocked<EntityManager>;
  let mockPocRepo: jest.Mocked<Repository<PocEntity>>;
  let mockChangeRepo: jest.Mocked<Repository<EffectiveChangeEntity>>;
  let mockOutboxRepo: jest.Mocked<Repository<OutboxEventEntity>>;

  beforeEach(() => {
    mockPocRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
      create: jest.fn().mockImplementation((dto: unknown) => dto),
    } as unknown as jest.Mocked<Repository<PocEntity>>;

    mockChangeRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
    } as unknown as jest.Mocked<Repository<EffectiveChangeEntity>>;

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto: unknown) => dto),
      save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
    } as unknown as jest.Mocked<Repository<OutboxEventEntity>>;

    mockEntityManager = {
      getRepository: jest.fn().mockImplementation((target: unknown) => {
        if (target === PocEntity) return mockPocRepo;
        if (target === EffectiveChangeEntity) return mockChangeRepo;
        if (target === OutboxEventEntity) return mockOutboxRepo;
        return null;
      }),
    } as unknown as jest.Mocked<EntityManager>;

    mockDataSource = {
      manager: mockEntityManager,
    } as unknown as jest.Mocked<DataSource>;

    handler = new PocApplyHandler(mockDataSource);
  });

  describe('apply CREATE', () => {
    const command: EffectiveExecuteCommand = {
      changeId: 'poc-1',
      tenantId: 'tenant-123',
      companyId: 'company-123',
      entityType: 'poc',
      operation: 'CREATE',
    };

    it('should transition scheduled PoC to active and emit POC_ASSIGNED event', async () => {
      const scheduledPoc = {
        id: 'poc-1',
        tenantId: 'tenant-123',
        companyId: 'company-123',
        pocType: PocType.HR_HEAD,
        employeeId: 'emp-1',
        status: MasterDataStatus.SCHEDULED,
        effectiveAt: new Date(),
      } as unknown as PocEntity;

      mockPocRepo.findOne.mockResolvedValue(scheduledPoc);

      await handler.apply(command, mockEntityManager);

      expect(scheduledPoc.status).toBe(MasterDataStatus.ACTIVE);
      expect(mockPocRepo.save).toHaveBeenCalledWith(scheduledPoc);
      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: AggregateType.POC,
          aggregateId: 'poc-1',
          eventType: PocEventType.POC_ASSIGNED,
        }),
      );
      expect(mockOutboxRepo.save).toHaveBeenCalled();
    });

    it('should skip idempotently if PoC is already active', async () => {
      const activePoc = {
        id: 'poc-1',
        status: MasterDataStatus.ACTIVE,
      } as unknown as PocEntity;

      mockPocRepo.findOne.mockResolvedValue(activePoc);

      await handler.apply(command, mockEntityManager);

      expect(mockPocRepo.save).not.toHaveBeenCalled();
      expect(mockOutboxRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('apply UPDATE', () => {
    const command: EffectiveExecuteCommand = {
      changeId: 'change-1',
      tenantId: 'tenant-123',
      companyId: 'company-123',
      entityType: 'poc',
      operation: 'UPDATE',
    };

    it('should archive prior active PoC, create new active PoC, and emit POC_REPLACED', async () => {
      const pendingChange = {
        id: 'change-1',
        tenantId: 'tenant-123',
        companyId: 'company-123',
        entityId: 'poc-old',
        status: EffectiveChangeStatus.SCHEDULED,
        payload: { newEmployeeId: 'emp-2' },
        effectiveAt: new Date(),
        createdBy: 'user-admin',
      } as unknown as EffectiveChangeEntity;

      const previousPoc = {
        id: 'poc-old',
        tenantId: 'tenant-123',
        companyId: 'company-123',
        pocType: PocType.FINANCE_HEAD,
        employeeId: 'emp-1',
        status: MasterDataStatus.ACTIVE,
      } as unknown as PocEntity;

      mockChangeRepo.findOne.mockResolvedValue(pendingChange);
      mockPocRepo.findOne.mockResolvedValue(previousPoc);

      await handler.apply(command, mockEntityManager);

      expect(previousPoc.status).toBe(MasterDataStatus.INACTIVE);
      expect(mockPocRepo.save).toHaveBeenCalledWith(previousPoc);

      expect(mockPocRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          companyId: 'company-123',
          pocType: PocType.FINANCE_HEAD,
          employeeId: 'emp-2',
          status: MasterDataStatus.ACTIVE,
        }),
      );

      expect(pendingChange.status).toBe(EffectiveChangeStatus.APPLIED);
      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: AggregateType.POC,
          eventType: PocEventType.POC_REPLACED,
        }),
      );
    });
  });

  describe('apply DEACTIVATE', () => {
    const command: EffectiveExecuteCommand = {
      changeId: 'change-deact',
      tenantId: 'tenant-123',
      companyId: 'company-123',
      entityType: 'poc',
      operation: 'DEACTIVATE',
    };

    it('should transition PoC to inactive and emit POC_DEACTIVATED', async () => {
      const pendingChange = {
        id: 'change-deact',
        tenantId: 'tenant-123',
        companyId: 'company-123',
        entityId: 'poc-1',
        status: EffectiveChangeStatus.SCHEDULED,
        effectiveAt: new Date(),
      } as unknown as EffectiveChangeEntity;

      const activePoc = {
        id: 'poc-1',
        tenantId: 'tenant-123',
        companyId: 'company-123',
        pocType: PocType.IT_HEAD,
        employeeId: 'emp-1',
        status: MasterDataStatus.ACTIVE,
      } as unknown as PocEntity;

      mockChangeRepo.findOne.mockResolvedValue(pendingChange);
      mockPocRepo.findOne.mockResolvedValue(activePoc);

      await handler.apply(command, mockEntityManager);

      expect(activePoc.status).toBe(MasterDataStatus.INACTIVE);
      expect(mockPocRepo.save).toHaveBeenCalledWith(activePoc);
      expect(pendingChange.status).toBe(EffectiveChangeStatus.APPLIED);
      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: AggregateType.POC,
          eventType: PocEventType.POC_DEACTIVATED,
        }),
      );
    });
  });
});
