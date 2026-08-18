import { AuthContext } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  EffectiveChangeEventType,
  EffectiveChangeStatus,
  MasterDataStatus,
  PocEventType,
  PocType,
  SetupStepType,
} from '../../src/enums';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { PocApplyHandler } from '../../src/modules/effective-change/handlers/poc-apply.handler';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';
import { EmployeeReferenceEntity } from '../../src/modules/employee-reference/entities/employee-reference.entity';
import { EmployeeReferenceRepository } from '../../src/modules/employee-reference/repositories/employee-reference.repository';
import { PocEntity } from '../../src/modules/poc/entities/poc.entity';
import { PocRepository } from '../../src/modules/poc/repositories/poc.repository';
import { PocQueryService } from '../../src/modules/poc/services/poc-query.service';
import { PocService } from '../../src/modules/poc/services/poc.service';

describe('PoC End-to-End Workflow Integration (US1-US5)', () => {
  let pocService: PocService;
  let pocQueryService: PocQueryService;
  let pocApplyHandler: PocApplyHandler;

  // In-memory mock store
  let pocStore: Map<string, PocEntity>;
  let changeStore: Map<string, EffectiveChangeEntity>;
  let outboxStore: OutboxEventEntity[];
  let stepStore: Map<string, string>;

  const tenantId = 'tenant-xyz';
  const companyId = 'company-xyz';
  const emp1Id = '11111111-1111-1111-1111-111111111111';
  const emp2Id = '22222222-2222-2222-2222-222222222222';
  const futureEffectiveDate = new Date(Date.now() + 86400000 * 5).toISOString();

  const authContext: AuthContext = {
    tenantCode: tenantId,
    userId: 'admin-user',
    roles: ['Administrator'],
    sessionId: 'session-123',
    scopes: [],
    permissions: ['poc:create', 'poc:update', 'poc:deactivate', 'poc:read'],
  };

  beforeEach(() => {
    pocStore = new Map();
    changeStore = new Map();
    outboxStore = [];
    stepStore = new Map();

    const mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto: Partial<OutboxEventEntity>) => {
        const event = { id: 'outbox-' + Math.random(), ...dto } as OutboxEventEntity;
        return event;
      }),
      save: jest.fn().mockImplementation((entity: OutboxEventEntity) => {
        outboxStore.push(entity);
        return Promise.resolve(entity);
      }),
    } as unknown as Repository<OutboxEventEntity>;

    const mockPocRepo = {
      findOne: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        for (const p of pocStore.values()) {
          if (where.id && p.id !== where.id) continue;
          if (where.tenantId && p.tenantId !== where.tenantId) continue;
          if (where.companyId && p.companyId !== where.companyId) continue;
          if (where.pocType && p.pocType !== where.pocType) continue;
          return Promise.resolve(p);
        }
        return Promise.resolve(null);
      }),
      find: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        const results: PocEntity[] = [];
        for (const p of pocStore.values()) {
          if (where.tenantId && p.tenantId !== where.tenantId) continue;
          if (where.companyId && p.companyId !== where.companyId) continue;
          if (where.status && p.status !== where.status) continue;
          results.push(p);
        }
        return Promise.resolve(results);
      }),
      create: jest.fn().mockImplementation((dto: Partial<PocEntity>) => {
        return {
          id: 'poc-' + Math.random(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...dto,
        } as PocEntity;
      }),
      save: jest.fn().mockImplementation((entity: PocEntity) => {
        if (!entity.id) entity.id = 'poc-' + Math.random();
        entity.updatedAt = new Date();
        pocStore.set(entity.id, entity);
        return Promise.resolve(entity);
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockImplementation(() => {
          const list = Array.from(pocStore.values());
          return Promise.resolve([list, list.length]);
        }),
      }),
    } as unknown as Repository<PocEntity>;

    const mockChangeRepo = {
      findOne: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        for (const c of changeStore.values()) {
          if (where.id && c.id !== where.id) continue;
          if (where.entityId && c.entityId !== where.entityId) continue;
          if (where.companyId && c.companyId !== where.companyId) continue;
          if (where.status && c.status !== where.status) continue;
          return Promise.resolve(c);
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation((dto: Partial<EffectiveChangeEntity>) => {
        return {
          id: 'change-' + Math.random(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...dto,
        } as EffectiveChangeEntity;
      }),
      save: jest.fn().mockImplementation((entity: EffectiveChangeEntity) => {
        if (!entity.id) entity.id = 'change-' + Math.random();
        entity.updatedAt = new Date();
        changeStore.set(entity.id, entity);
        return Promise.resolve(entity);
      }),
    } as unknown as Repository<EffectiveChangeEntity>;

    const mockEntityManager = {
      getRepository: jest.fn().mockImplementation((target: unknown) => {
        if (target === PocEntity) return mockPocRepo;
        if (target === EffectiveChangeEntity) return mockChangeRepo;
        if (target === OutboxEventEntity) return mockOutboxRepo;
        return null;
      }),
    } as unknown as EntityManager;

    const mockDataSource = {
      manager: mockEntityManager,
      createEntityManager: jest.fn().mockReturnValue(mockEntityManager),
    } as unknown as DataSource;

    const pocRepository = new PocRepository(mockPocRepo);
    const effectiveChangeRepository = {
      findPendingChange: jest
        .fn()
        .mockImplementation((cId: string, entityType: string, entityId: string) => {
          for (const c of changeStore.values()) {
            if (
              c.companyId === cId &&
              c.entityType === entityType &&
              c.entityId === entityId &&
              c.status === EffectiveChangeStatus.SCHEDULED
            ) {
              return Promise.resolve(c);
            }
          }
          return Promise.resolve(null);
        }),
      createAndSave: jest.fn().mockImplementation((changeData: Partial<EffectiveChangeEntity>) => {
        const entity = {
          id: 'change-' + Math.random(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...changeData,
        } as EffectiveChangeEntity;
        changeStore.set(entity.id, entity);
        return Promise.resolve(entity);
      }),
    } as unknown as EffectiveChangeRepository;

    const employeeRefRepo = {
      findByEmployeeId: jest.fn().mockImplementation((tId: string, empId: string) => {
        return Promise.resolve({
          id: 'ref-' + empId,
          tenantId: tId,
          companyId,
          employeeId: empId,
          employeeNumber: 'EMP-' + empId.substring(0, 4),
          displayName: empId === emp1Id ? 'Alice Walker' : 'Bob Ross',
          employmentStatus: 'ACTIVE',
        } as EmployeeReferenceEntity);
      }),
      findByEmployeeIds: jest.fn().mockImplementation((tId: string, empIds: string[]) => {
        return Promise.resolve(
          empIds.map(
            (id) =>
              ({
                id: 'ref-' + id,
                tenantId: tId,
                companyId,
                employeeId: id,
                employeeNumber: 'EMP-' + id.substring(0, 4),
                displayName: id === emp1Id ? 'Alice Walker' : 'Bob Ross',
                employmentStatus: 'ACTIVE',
              }) as EmployeeReferenceEntity,
          ),
        );
      }),
    } as unknown as EmployeeReferenceRepository;

    const mockCompanyRepo = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: companyId,
        tenantId,
        timezone: 'UTC',
      } as CompanyEntity),
    } as unknown as CompanyRepository;

    const mockCompanySetupStepRepo = {
      markStepCompleted: jest.fn().mockImplementation((params: { stepType: string }) => {
        stepStore.set(params.stepType, 'COMPLETED');
        return Promise.resolve({ status: 'completed' });
      }),
    } as unknown as CompanySetupStepRepository;

    const transactionService = {
      runInTransaction: jest.fn().mockImplementation(async (cb: () => Promise<unknown>) => cb()),
    } as unknown as TransactionService;

    pocService = new PocService(
      mockDataSource,
      transactionService,
      pocRepository,
      employeeRefRepo,
      mockCompanyRepo,
      mockCompanySetupStepRepo,
      effectiveChangeRepository,
    );

    pocQueryService = new PocQueryService(
      pocRepository,
      employeeRefRepo,
      effectiveChangeRepository,
    );

    pocApplyHandler = new PocApplyHandler(mockDataSource);
  });

  it('should execute full lifecycle: create -> activate -> replace -> apply replace -> query -> deactivate -> apply deactivate', async () => {
    // 1. Create Initial PoC Assignment (US1)
    const initialPoc = await pocService.create(
      companyId,
      {
        pocType: PocType.HR_HEAD,
        employeeId: emp1Id,
        effectiveAt: futureEffectiveDate,
      },
      authContext,
    );

    expect(initialPoc.status).toBe(MasterDataStatus.SCHEDULED);
    expect(stepStore.get(SetupStepType.POC)).toBe('COMPLETED');
    expect(outboxStore).toHaveLength(1);
    expect(outboxStore[0].eventType).toBe(EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED);

    // 2. Go Worker Executes Scheduled CREATE
    await pocApplyHandler.apply({
      changeId: initialPoc.id,
      tenantId,
      companyId,
      entityType: 'poc',
      operation: 'CREATE',
    });

    const activePoc = pocStore.get(initialPoc.id)!;
    expect(activePoc.status).toBe(MasterDataStatus.ACTIVE);
    expect(outboxStore.some((e) => e.eventType === PocEventType.POC_ASSIGNED)).toBe(true);

    // 3. Query Active PoCs (US5)
    let activeList = await pocQueryService.findActiveByCompany(companyId, authContext);
    expect(activeList).toHaveLength(1);
    expect(activeList[0].displayName).toBe('Alice Walker');
    expect(activeList[0].hasPendingChange).toBe(false);

    // 4. Schedule Replacement with Emp2 (US2)
    const replaceChange = await pocService.replace(
      companyId,
      activePoc.id,
      {
        newEmployeeId: emp2Id,
        effectiveAt: futureEffectiveDate,
        reason: 'Succession Plan',
      },
      authContext,
    );

    expect(replaceChange.status).toBe(EffectiveChangeStatus.SCHEDULED);
    // Incumbent still active
    expect(pocStore.get(initialPoc.id)!.status).toBe(MasterDataStatus.ACTIVE);

    // Query reflects pending change
    activeList = await pocQueryService.findActiveByCompany(companyId, authContext);
    expect(activeList[0].hasPendingChange).toBe(true);

    // 5. Go Worker Executes Scheduled UPDATE
    await pocApplyHandler.apply({
      changeId: replaceChange.id,
      tenantId,
      companyId,
      entityType: 'poc',
      operation: 'UPDATE',
    });

    expect(pocStore.get(initialPoc.id)!.status).toBe(MasterDataStatus.INACTIVE);
    expect(outboxStore.some((e) => e.eventType === PocEventType.POC_REPLACED)).toBe(true);

    // New active PoC exists
    activeList = await pocQueryService.findActiveByCompany(companyId, authContext);
    expect(activeList).toHaveLength(1);
    expect(activeList[0].employeeId).toBe(emp2Id);
    expect(activeList[0].displayName).toBe('Bob Ross');

    const newActivePocId = activeList[0].id;

    // 6. Schedule Deactivation (US3)
    const deactChange = await pocService.deactivate(
      companyId,
      newActivePocId,
      {
        effectiveAt: futureEffectiveDate,
        reason: 'Restructuring',
      },
      authContext,
    );

    expect(deactChange.status).toBe(EffectiveChangeStatus.SCHEDULED);

    // 7. Go Worker Executes Scheduled DEACTIVATE
    await pocApplyHandler.apply({
      changeId: deactChange.id,
      tenantId,
      companyId,
      entityType: 'poc',
      operation: 'DEACTIVATE',
    });

    expect(pocStore.get(newActivePocId)!.status).toBe(MasterDataStatus.INACTIVE);
    expect(outboxStore.some((e) => e.eventType === PocEventType.POC_DEACTIVATED)).toBe(true);

    // 8. Active list now empty
    activeList = await pocQueryService.findActiveByCompany(companyId, authContext);
    expect(activeList).toHaveLength(0);
  });
});
