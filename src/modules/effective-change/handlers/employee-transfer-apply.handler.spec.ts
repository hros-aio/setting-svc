import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  AggregateType,
  EmployeeTransferEventType,
  EmployeeTransferStatus,
  OutboxStatus,
} from '../../../enums';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { EmployeeReferenceEntity } from '../../employee-reference/entities/employee-reference.entity';
import { EmployeeTransferEntity } from '../../employee-transfer/entities/employee-transfer.entity';
import { EmployeeTransferApplyHandler } from './employee-transfer-apply.handler';

describe('EmployeeTransferApplyHandler', () => {
  let handler: EmployeeTransferApplyHandler;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockEntityManager: jest.Mocked<EntityManager>;
  let mockTransferRepo: jest.Mocked<Repository<EmployeeTransferEntity>>;
  let mockEmployeeRefRepo: jest.Mocked<Repository<EmployeeReferenceEntity>>;
  let mockOutboxRepo: jest.Mocked<Repository<OutboxEventEntity>>;

  beforeEach(() => {
    mockTransferRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    } as unknown as jest.Mocked<Repository<EmployeeTransferEntity>>;

    mockEmployeeRefRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    } as unknown as jest.Mocked<Repository<EmployeeReferenceEntity>>;

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((e: unknown) => e),
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    } as unknown as jest.Mocked<Repository<OutboxEventEntity>>;

    mockEntityManager = {
      getRepository: jest.fn().mockImplementation((target: unknown) => {
        if (target === EmployeeTransferEntity) return mockTransferRepo;
        if (target === EmployeeReferenceEntity) return mockEmployeeRefRepo;
        if (target === OutboxEventEntity) return mockOutboxRepo;
        return null;
      }),
    } as unknown as jest.Mocked<EntityManager>;

    mockDataSource = {
      manager: mockEntityManager,
    } as unknown as jest.Mocked<DataSource>;

    handler = new EmployeeTransferApplyHandler(mockDataSource);
  });

  it('should skip execution if transfer is not found', async () => {
    mockTransferRepo.findOne.mockResolvedValue(null);

    await handler.apply(
      {
        changeId: 'trans-1',
        tenantId: 'tenant-1',
        companyId: 'comp-2',
        entityType: 'employee_transfer',
        operation: 'EXECUTE',
      },
      mockEntityManager,
    );

    expect(mockTransferRepo.save).not.toHaveBeenCalled();
    expect(mockOutboxRepo.save).not.toHaveBeenCalled();
  });

  it('should skip execution if transfer is already COMPLETED (idempotent)', async () => {
    mockTransferRepo.findOne.mockResolvedValue({
      id: 'trans-1',
      tenantId: 'tenant-1',
      status: EmployeeTransferStatus.COMPLETED,
    } as EmployeeTransferEntity);

    await handler.apply(
      {
        changeId: 'trans-1',
        tenantId: 'tenant-1',
        companyId: 'comp-2',
        entityType: 'employee_transfer',
        operation: 'EXECUTE',
      },
      mockEntityManager,
    );

    expect(mockTransferRepo.save).not.toHaveBeenCalled();
    expect(mockOutboxRepo.save).not.toHaveBeenCalled();
  });

  it('should transition employee attribution, mark transfer COMPLETED, and emit domain event', async () => {
    const mockTransfer = {
      id: 'trans-1',
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      sourceCompanyId: 'comp-1',
      destinationCompanyId: 'comp-2',
      destinationLocationId: 'loc-1',
      destinationDepartmentId: 'dept-1',
      destinationGradeId: 'grade-1',
      destinationJobTitleId: 'job-1',
      status: EmployeeTransferStatus.PENDING,
      effectiveAt: new Date('2026-08-25T00:00:00.000Z'),
    } as EmployeeTransferEntity;

    const mockEmployeeRef = {
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      companyId: 'comp-1',
      sourceVersion: '1',
    } as EmployeeReferenceEntity;

    mockTransferRepo.findOne.mockResolvedValue(mockTransfer);
    mockEmployeeRefRepo.findOne.mockResolvedValue(mockEmployeeRef);

    await handler.apply(
      {
        changeId: 'trans-1',
        tenantId: 'tenant-1',
        companyId: 'comp-2',
        entityType: 'employee_transfer',
        operation: 'EXECUTE',
      },
      mockEntityManager,
    );

    expect(mockEmployeeRef.companyId).toBe('comp-2');
    expect(mockEmployeeRef.sourceVersion).toBe('2');
    expect(mockEmployeeRefRepo.save).toHaveBeenCalledWith(mockEmployeeRef);

    expect(mockTransfer.status).toBe(EmployeeTransferStatus.COMPLETED);
    expect(mockTransfer.completedAt).toBeDefined();
    expect(mockTransferRepo.save).toHaveBeenCalledWith(mockTransfer);

    expect(mockOutboxRepo.create).toHaveBeenCalledWith({
      aggregateType: AggregateType.EMPLOYEE_TRANSFER,
      aggregateId: 'trans-1',
      eventType: EmployeeTransferEventType.EMPLOYEE_COMPANY_TRANSFERRED,
      payload: expect.objectContaining({
        transferId: 'trans-1',
        employeeId: 'emp-1',
        sourceCompanyId: 'comp-1',
        destinationCompanyId: 'comp-2',
        continuousEmployment: true,
      }),
      executionTime: expect.any(Date),
      status: OutboxStatus.PENDING,
    });
    expect(mockOutboxRepo.save).toHaveBeenCalled();
  });
});
