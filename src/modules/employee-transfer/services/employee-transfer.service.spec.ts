import { AuthContext } from '@new-hros/libs-core';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  AggregateType,
  EffectiveChangeEventType,
  EmployeeTransferStatus,
  OutboxStatus,
} from '../../../enums';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferService } from './employee-transfer.service';
import { ValidateTransferRequestService } from './validate-transfer-request.service';

describe('EmployeeTransferService', () => {
  let service: EmployeeTransferService;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockEntityManager: jest.Mocked<EntityManager>;
  let mockTransferRepo: jest.Mocked<Repository<EmployeeTransferEntity>>;
  let mockOutboxRepo: jest.Mocked<Repository<OutboxEventEntity>>;
  let mockValidateService: jest.Mocked<ValidateTransferRequestService>;

  const futureDate = new Date(Date.now() + 86400000 * 7);

  beforeEach(() => {
    mockTransferRepo = {
      create: jest.fn().mockImplementation((e: unknown) => e),
      save: jest
        .fn()
        .mockImplementation((e: Record<string, unknown>) =>
          Promise.resolve({ id: 'trans-1', ...e }),
        ),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmployeeTransferEntity>>;

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((e: unknown) => e),
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    } as unknown as jest.Mocked<Repository<OutboxEventEntity>>;

    mockEntityManager = {
      getRepository: jest.fn().mockImplementation((target: unknown) => {
        if (target === EmployeeTransferEntity) return mockTransferRepo;
        if (target === OutboxEventEntity) return mockOutboxRepo;
        return null;
      }),
    } as unknown as jest.Mocked<EntityManager>;

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(async (cb: (em: EntityManager) => Promise<unknown>) => {
          return cb(mockEntityManager);
        }),
      manager: mockEntityManager,
    } as unknown as jest.Mocked<DataSource>;

    mockValidateService = {
      validate: jest.fn(),
    } as unknown as jest.Mocked<ValidateTransferRequestService>;

    service = new EmployeeTransferService(mockDataSource, mockValidateService);
  });

  describe('initiateTransfer', () => {
    it('should validate, persist pending transfer, and write outbox scheduling event in one transaction', async () => {
      mockValidateService.validate.mockResolvedValue({
        destinationCompanyId: 'comp-2',
        sourceCompanyId: 'comp-1',
        employeeId: 'emp-1',
        effectiveAt: futureDate,
      });

      const result = await service.initiateTransfer(
        'tenant-1',
        'comp-1',
        'emp-1',
        {
          companyId: 'comp-1',
          employeeId: 'emp-1',
          destinationCompanyId: 'comp-2',
          destinationLocationId: 'loc-1',
          destinationDepartmentId: 'dept-1',
          destinationGradeId: 'grade-1',
          destinationJobTitleId: 'job-1',
          effectiveAt: futureDate.toISOString(),
          notes: 'Transfer notes',
        },
        { userId: 'user-admin' } as unknown as AuthContext,
      );

      expect(mockValidateService.validate).toHaveBeenCalledWith(
        'tenant-1',
        'comp-1',
        'emp-1',
        expect.any(Object),
        mockEntityManager,
      );

      expect(mockTransferRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          employeeId: 'emp-1',
          sourceCompanyId: 'comp-1',
          destinationCompanyId: 'comp-2',
          destinationLocationId: 'loc-1',
          status: EmployeeTransferStatus.PENDING,
          createdBy: 'user-admin',
        }),
      );
      expect(mockTransferRepo.save).toHaveBeenCalled();

      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: AggregateType.EMPLOYEE_TRANSFER,
          aggregateId: 'trans-1',
          eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
          status: OutboxStatus.PENDING,
          payload: expect.objectContaining({
            transferId: 'trans-1',
            changeType: 'EMPLOYEE_TRANSFER',
            destinationCompanyId: 'comp-2',
          }),
        }),
      );
      expect(mockOutboxRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('trans-1');
    });
  });
});
