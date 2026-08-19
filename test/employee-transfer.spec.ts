import { AuthContext } from '@new-hros/libs-core';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  CompanyStatus,
  EffectiveChangeEventType,
  EmployeeTransferEventType,
  EmployeeTransferStatus,
  MasterDataStatus,
} from '../src/enums';
import { CompanyEntity } from '../src/modules/company/entities/company.entity';
import { OutboxEventEntity } from '../src/modules/company/entities/outbox-event.entity';
import { CompanyRepository } from '../src/modules/company/repositories/company.repository';
import { DepartmentRepository } from '../src/modules/department/repositories/department.repository';
import { EmployeeTransferApplyHandler } from '../src/modules/effective-change/handlers/employee-transfer-apply.handler';
import { EmployeeReferenceEntity } from '../src/modules/employee-reference/entities/employee-reference.entity';
import { EmployeeReferenceRepository } from '../src/modules/employee-reference/repositories/employee-reference.repository';
import { EmployeeTransferController } from '../src/modules/employee-transfer/controllers/employee-transfer.controller';
import { EmployeeTransferEntity } from '../src/modules/employee-transfer/entities/employee-transfer.entity';
import { EmployeeTransferRepository } from '../src/modules/employee-transfer/repositories/employee-transfer.repository';
import { EmployeeTransferQueryService } from '../src/modules/employee-transfer/services/employee-transfer-query.service';
import { EmployeeTransferService } from '../src/modules/employee-transfer/services/employee-transfer.service';
import { ValidateTransferRequestService } from '../src/modules/employee-transfer/services/validate-transfer-request.service';
import { GradeRepository } from '../src/modules/grade/repositories/grade.repository';
import { JobTitleRepository } from '../src/modules/job-title/repositories/job-title.repository';
import { LocationRepository } from '../src/modules/location/repositories/location.repository';

describe('Employee Transfer End-to-End Workflow Integration (US1-US4)', () => {
  let controller: EmployeeTransferController;
  let transferService: EmployeeTransferService;
  let queryService: EmployeeTransferQueryService;
  let applyHandler: EmployeeTransferApplyHandler;

  // In-memory data stores
  let transferStore: Map<string, EmployeeTransferEntity>;
  let employeeRefStore: Map<string, EmployeeReferenceEntity>;
  let outboxStore: OutboxEventEntity[];

  const tenantId = 'tenant-1111-1111';
  const sourceCompanyId = 'comp-source-1111';
  const destinationCompanyId = 'comp-dest-2222';
  const empId = 'emp-3333-3333';
  const futureEffectiveDate = new Date(Date.now() + 86400000 * 5).toISOString();

  const authContext: AuthContext = {
    tenantCode: tenantId,
    userId: 'admin-user',
    roles: ['Administrator'],
    sessionId: 'session-123',
    scopes: [],
    permissions: ['employee-transfer:create', 'employee-transfer:read'],
  };

  beforeEach(() => {
    transferStore = new Map();
    employeeRefStore = new Map();
    outboxStore = [];

    // Seed active employee reference in source company
    employeeRefStore.set(empId, {
      id: 'ref-1',
      tenantId,
      employeeId: empId,
      employeeNumber: 'EMP-001',
      companyId: sourceCompanyId,
      sourceVersion: '1',
    } as EmployeeReferenceEntity);

    const mockCompanyRepo = {
      findByIdAndTenant: jest.fn().mockImplementation((id: string, tId: string) => {
        if (tId === tenantId && (id === sourceCompanyId || id === destinationCompanyId)) {
          return Promise.resolve({
            id,
            tenantId: tId,
            status: CompanyStatus.ACTIVE,
          } as CompanyEntity);
        }
        return Promise.resolve(null);
      }),
    } as unknown as jest.Mocked<CompanyRepository>;

    const mockEmployeeRefRepo = {
      findByEmployeeId: jest.fn().mockImplementation((tId: string, eId: string) => {
        if (tId === tenantId && employeeRefStore.has(eId)) {
          return Promise.resolve(employeeRefStore.get(eId)!);
        }
        return Promise.resolve(null);
      }),
    } as unknown as jest.Mocked<EmployeeReferenceRepository>;

    const mockLocationRepo = {
      findById: jest.fn().mockImplementation((tId: string, cId: string, id: string) => {
        if (tId === tenantId && cId === destinationCompanyId && id === 'loc-valid') {
          return Promise.resolve({ id, status: MasterDataStatus.ACTIVE });
        }
        return Promise.resolve(null);
      }),
    } as unknown as jest.Mocked<LocationRepository>;

    const mockDeptRepo = {
      findById: jest.fn().mockImplementation((tId: string, cId: string, id: string) => {
        if (tId === tenantId && cId === destinationCompanyId && id === 'dept-valid') {
          return Promise.resolve({ id, status: MasterDataStatus.ACTIVE });
        }
        return Promise.resolve(null);
      }),
    } as unknown as jest.Mocked<DepartmentRepository>;

    const mockGradeRepo = {
      findById: jest.fn().mockImplementation((tId: string, cId: string, id: string) => {
        if (tId === tenantId && cId === destinationCompanyId && id === 'grade-valid') {
          return Promise.resolve({ id, status: MasterDataStatus.ACTIVE });
        }
        return Promise.resolve(null);
      }),
    } as unknown as jest.Mocked<GradeRepository>;

    const mockJobTitleRepo = {
      findById: jest.fn().mockImplementation((tId: string, cId: string, id: string) => {
        if (tId === tenantId && cId === destinationCompanyId && id === 'job-valid') {
          return Promise.resolve({ id, status: MasterDataStatus.ACTIVE });
        }
        return Promise.resolve(null);
      }),
    } as unknown as jest.Mocked<JobTitleRepository>;

    const mockTransferEntityRepo = {
      create: jest.fn().mockImplementation((dto: Partial<EmployeeTransferEntity>) => {
        return {
          id: 'trans-' + (transferStore.size + 1),
          ...dto,
        } as EmployeeTransferEntity;
      }),
      save: jest.fn().mockImplementation((entity: EmployeeTransferEntity) => {
        transferStore.set(entity.id, entity);
        return Promise.resolve(entity);
      }),
      findOne: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        for (const t of transferStore.values()) {
          let match = true;
          if (where.id && t.id !== where.id) match = false;
          if (where.tenantId && t.tenantId !== where.tenantId) match = false;
          if (where.employeeId && t.employeeId !== where.employeeId) match = false;
          if (where.status && t.status !== where.status) match = false;
          if (match) return Promise.resolve(t);
        }
        return Promise.resolve(null);
      }),
      findAndCount: jest
        .fn()
        .mockImplementation(({ where }: { where: Record<string, unknown> }) => {
          const items: EmployeeTransferEntity[] = [];
          for (const t of transferStore.values()) {
            if (t.tenantId === where.tenantId && t.employeeId === where.employeeId) {
              items.push(t);
            }
          }
          return Promise.resolve([items, items.length]);
        }),
    } as unknown as Repository<EmployeeTransferEntity>;

    const mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto: Partial<OutboxEventEntity>) => {
        return { id: 'outbox-' + Math.random(), ...dto } as OutboxEventEntity;
      }),
      save: jest.fn().mockImplementation((entity: OutboxEventEntity) => {
        outboxStore.push(entity);
        return Promise.resolve(entity);
      }),
    } as unknown as Repository<OutboxEventEntity>;

    const mockEmpRefEntityRepo = {
      findOne: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        if (where.employeeId && employeeRefStore.has(where.employeeId as string)) {
          return Promise.resolve(employeeRefStore.get(where.employeeId as string)!);
        }
        return Promise.resolve(null);
      }),
      save: jest.fn().mockImplementation((entity: EmployeeReferenceEntity) => {
        employeeRefStore.set(entity.employeeId, entity);
        return Promise.resolve(entity);
      }),
    } as unknown as Repository<EmployeeReferenceEntity>;

    const mockEntityManager = {
      getRepository: jest.fn().mockImplementation((target: unknown) => {
        if (target === EmployeeTransferEntity) return mockTransferEntityRepo;
        if (target === OutboxEventEntity) return mockOutboxRepo;
        if (target === EmployeeReferenceEntity) return mockEmpRefEntityRepo;
        return null;
      }),
    } as unknown as EntityManager;

    const mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(async (cb: (em: EntityManager) => Promise<unknown>) => {
          return cb(mockEntityManager);
        }),
      manager: mockEntityManager,
    } as unknown as DataSource;

    const employeeTransferRepo = new EmployeeTransferRepository(mockTransferEntityRepo);

    const validateService = new ValidateTransferRequestService(
      mockCompanyRepo,
      mockEmployeeRefRepo,
      employeeTransferRepo,
      mockLocationRepo,
      mockDeptRepo,
      mockGradeRepo,
      mockJobTitleRepo,
    );

    transferService = new EmployeeTransferService(mockDataSource, validateService);

    queryService = new EmployeeTransferQueryService(employeeTransferRepo);

    controller = new EmployeeTransferController(transferService, queryService);

    applyHandler = new EmployeeTransferApplyHandler(mockDataSource);
  });

  describe('Full Inter-Company Employee Transfer Lifecycle', () => {
    it('should complete the entire schedule, query, apply execution, and history lifecycle', async () => {
      // 1. Initial State: Employee is in source company
      const initialRef = employeeRefStore.get(empId);
      expect(initialRef?.companyId).toBe(sourceCompanyId);

      // 2. Schedule Transfer (User Story 1 & 3)
      const transfer = await controller.initiateTransfer(
        {
          tenantId,
          companyId: sourceCompanyId,
          employeeId: empId,
          destinationCompanyId,
          destinationLocationId: 'loc-valid',
          destinationDepartmentId: 'dept-valid',
          destinationGradeId: 'grade-valid',
          destinationJobTitleId: 'job-valid',
          effectiveAt: futureEffectiveDate,
          notes: 'Strategic talent mobility',
        },
        authContext,
      );

      expect(transfer.id).toBeDefined();
      expect(transfer.status).toBe(EmployeeTransferStatus.PENDING);
      expect(transfer.sourceCompanyId).toBe(sourceCompanyId);
      expect(transfer.destinationCompanyId).toBe(destinationCompanyId);

      // Verify source company active attribution is unchanged prior to effective date
      expect(employeeRefStore.get(empId)?.companyId).toBe(sourceCompanyId);

      // Verify scheduling outbox event is staged
      const scheduledEvent = outboxStore.find(
        (e) => e.eventType === EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      );
      expect(scheduledEvent).toBeDefined();
      expect(scheduledEvent?.payload.transferId).toBe(transfer.id);

      // 3. Prevent duplicate pending transfer (INV-007, BR-33)
      await expect(
        controller.initiateTransfer(
          {
            tenantId,
            companyId: sourceCompanyId,
            employeeId: empId,
            destinationCompanyId,
            effectiveAt: futureEffectiveDate,
          },
          authContext,
        ),
      ).rejects.toThrow();

      // 4. Query Pending Transfer (User Story 4)
      const pendingTransfer = await controller.getPendingTransfer(
        { employeeId: empId },
        authContext,
      );
      expect(pendingTransfer).toBeDefined();
      expect(pendingTransfer?.id).toBe(transfer.id);
      expect(pendingTransfer?.status).toBe(EmployeeTransferStatus.PENDING);

      // 5. Automated Execution upon Effective Date (User Story 2)
      await applyHandler.apply({
        changeId: transfer.id,
        tenantId,
        companyId: destinationCompanyId,
        entityType: 'employee_transfer',
        operation: 'EXECUTE',
      });

      // Verify transfer transitioned to COMPLETED
      const completedTransfer = transferStore.get(transfer.id);
      expect(completedTransfer?.status).toBe(EmployeeTransferStatus.COMPLETED);
      expect(completedTransfer?.completedAt).toBeDefined();

      // Verify continuous employment: active attribution transitioned to destination company
      const updatedRef = employeeRefStore.get(empId);
      expect(updatedRef?.companyId).toBe(destinationCompanyId);
      expect(updatedRef?.sourceVersion).toBe('2');

      // Verify domain synchronization event employee.company-transferred was emitted
      const completionEvent = outboxStore.find(
        (e) => e.eventType === EmployeeTransferEventType.EMPLOYEE_COMPANY_TRANSFERRED,
      );
      expect(completionEvent).toBeDefined();
      expect(completionEvent?.payload.destinationCompanyId).toBe(destinationCompanyId);
      expect(completionEvent?.payload.continuousEmployment).toBe(true);

      // 6. Query Transfer History (User Story 4)
      const history = await controller.getTransferHistory(
        { employeeId: empId, limit: 10, offset: 0 },
        authContext,
      );

      expect(history.total).toBe(1);
      expect(history.items[0].id).toBe(transfer.id);
      expect(history.items[0].status).toBe(EmployeeTransferStatus.COMPLETED);
    });
  });
});
