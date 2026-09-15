import { Department, TransactionService } from '@new-hros/libs-sql';
import { EntityManager, Repository } from 'typeorm';
import { DepartmentEventType, EffectiveChangeStatus, MasterDataStatus } from '../../src/enums';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { DepartmentApplyHandler } from '../../src/modules/effective-change/handlers/department-apply.handler';

describe('DepartmentApplyHandler [US5]', () => {
  let handler: DepartmentApplyHandler;
  let mockDepartmentRepo: jest.Mocked<Partial<Repository<Department>>>;
  let mockChangeRepo: jest.Mocked<Partial<Repository<EffectiveChangeEntity>>>;
  let mockOutboxRepo: jest.Mocked<Partial<Repository<OutboxEventEntity>>>;
  let mockEm: jest.Mocked<Partial<EntityManager>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;

  beforeEach(() => {
    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => dto as OutboxEventEntity),
      save: jest.fn().mockResolvedValue({ id: 'outbox-1' } as OutboxEventEntity),
    };

    mockDepartmentRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (dept) => dept as Department),
    };

    mockChangeRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (chg) => chg as EffectiveChangeEntity),
    };

    mockEm = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === Department || entity.name === 'Department') {
          return mockDepartmentRepo as unknown as Repository<Department>;
        }
        if (entity === EffectiveChangeEntity || entity.name === 'EffectiveChangeEntity') {
          return mockChangeRepo as unknown as Repository<EffectiveChangeEntity>;
        }
        return mockOutboxRepo as unknown as Repository<OutboxEventEntity>;
      }),
    };

    mockTxService = {
      getManager: jest.fn().mockReturnValue(mockEm as EntityManager),
    };

    handler = new DepartmentApplyHandler(mockTxService as unknown as TransactionService);
  });

  it('should transition scheduled department to active on CREATE', async () => {
    const mockDepartment = {
      id: 'dept-1',
      tenantCode: 'tenant-1',
      companyId: 'comp-1',
      status: MasterDataStatus.SCHEDULED,
      code: 'ENG',
      name: 'Engineering',
    } as unknown as Department;
    (mockDepartmentRepo.findOne as jest.Mock).mockResolvedValue(mockDepartment);

    await handler.apply({
      changeId: 'dept-1',
      tenantCode: 'tenant-1',
      companyId: 'comp-1',
      entityType: 'department',
      operation: 'CREATE',
    });

    expect(mockDepartment.status).toBe(MasterDataStatus.ACTIVE);
    expect(mockDepartmentRepo.save).toHaveBeenCalledWith(mockDepartment);
    expect(mockOutboxRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: DepartmentEventType.DEPARTMENT_CREATED,
      }),
    );
  });

  it('should apply mutations and publish event on UPDATE', async () => {
    const mockChange = {
      id: 'chg-1',
      entityId: 'dept-1',
      tenantCode: 'tenant-1',
      companyId: 'comp-1',
      status: EffectiveChangeStatus.SCHEDULED,
      payload: { name: 'Platform & Backend Engineering' },
      expectedUpdatedAt: new Date('2026-08-16T00:00:00Z'),
    } as unknown as EffectiveChangeEntity;
    const mockDepartment = {
      id: 'dept-1',
      tenantCode: 'tenant-1',
      companyId: 'comp-1',
      name: 'Engineering',
      updatedAt: new Date('2026-08-16T00:00:00Z'),
    } as unknown as Department;

    (mockChangeRepo.findOne as jest.Mock).mockResolvedValue(mockChange);
    (mockDepartmentRepo.findOne as jest.Mock).mockResolvedValue(mockDepartment);

    await handler.apply({
      changeId: 'chg-1',
      tenantCode: 'tenant-1',
      companyId: 'comp-1',
      entityType: 'department',
      operation: 'UPDATE',
    });

    expect(mockDepartment.name).toBe('Platform & Backend Engineering');
    expect(mockDepartmentRepo.save).toHaveBeenCalledWith(mockDepartment);
    expect(mockChange.status).toBe(EffectiveChangeStatus.APPLIED);
    expect(mockOutboxRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: DepartmentEventType.DEPARTMENT_UPDATED,
      }),
    );
  });

  it('should deactivate department on DEACTIVATE operation', async () => {
    const mockChange = {
      id: 'chg-1',
      entityId: 'dept-1',
      tenantCode: 'tenant-1',
      companyId: 'comp-1',
      status: EffectiveChangeStatus.SCHEDULED,
      expectedUpdatedAt: new Date('2026-08-16T00:00:00Z'),
    } as unknown as EffectiveChangeEntity;
    const mockDepartment = {
      id: 'dept-1',
      tenantCode: 'tenant-1',
      companyId: 'comp-1',
      status: MasterDataStatus.ACTIVE,
      updatedAt: new Date('2026-08-16T00:00:00Z'),
    } as unknown as Department;

    (mockChangeRepo.findOne as jest.Mock).mockResolvedValue(mockChange);
    (mockDepartmentRepo.findOne as jest.Mock).mockResolvedValue(mockDepartment);

    await handler.apply({
      changeId: 'chg-1',
      tenantCode: 'tenant-1',
      companyId: 'comp-1',
      entityType: 'department',
      operation: 'DEACTIVATE',
    });

    expect(mockDepartment.status).toBe(MasterDataStatus.INACTIVE);
    expect(mockChange.status).toBe(EffectiveChangeStatus.APPLIED);
    expect(mockOutboxRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: DepartmentEventType.DEPARTMENT_DEACTIVATED,
      }),
    );
  });
});
