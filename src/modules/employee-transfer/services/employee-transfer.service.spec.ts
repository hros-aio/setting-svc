import { RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import {
  AggregateType,
  EffectiveChangeEventType,
  EmployeeTransferStatus,
  OutboxStatus,
} from '../../../enums';
import { OutboxEventRepository } from '../../company/repositories/outbox-event.repository';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferRepository } from '../repositories/employee-transfer.repository';
import { EmployeeTransferService } from './employee-transfer.service';
import { ValidateTransferRequestService } from './validate-transfer-request.service';

describe('EmployeeTransferService', () => {
  let service: EmployeeTransferService;
  let mockTxService: jest.Mocked<TransactionService>;
  let mockTransferRepo: jest.Mocked<EmployeeTransferRepository>;
  let mockOutboxRepo: jest.Mocked<OutboxEventRepository>;
  let mockValidateService: jest.Mocked<ValidateTransferRequestService>;

  const futureDate = new Date(Date.now() + 86400000 * 7);

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-admin',
      employee: { companyId: 'comp-1' },
    } as unknown as ReturnType<typeof RequestContextService.getUser>);

    mockTransferRepo = {
      create: jest.fn().mockImplementation((e: Record<string, unknown>) =>
        Promise.resolve({ id: 'trans-1', ...e } as EmployeeTransferEntity),
      ),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<EmployeeTransferRepository>;

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((e: Record<string, unknown>) =>
        Promise.resolve({ id: 'outbox-1', ...e }),
      ),
    } as unknown as jest.Mocked<OutboxEventRepository>;

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation(async (cb: () => Promise<unknown>) => cb()),
    } as unknown as jest.Mocked<TransactionService>;

    mockValidateService = {
      validate: jest.fn(),
    } as unknown as jest.Mocked<ValidateTransferRequestService>;

    service = new EmployeeTransferService(
      mockValidateService,
      mockTxService,
      mockTransferRepo,
      mockOutboxRepo,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initiateTransfer', () => {
    it('should validate, persist pending transfer, and write outbox scheduling event in one transaction', async () => {
      mockValidateService.validate.mockResolvedValue({
        destinationCompanyId: 'comp-2',
        sourceCompanyId: 'comp-1',
        employeeId: 'emp-1',
        effectiveAt: futureDate,
      });

      const dto = {
        companyId: 'comp-1',
        employeeId: 'emp-1',
        destinationCompanyId: 'comp-2',
        destinationLocationId: 'loc-1',
        destinationDepartmentId: 'dept-1',
        destinationGradeId: 'grade-1',
        destinationJobTitleId: 'job-1',
        effectiveAt: futureDate.toISOString(),
        notes: 'Transfer notes',
      };

      const result = await service.initiateTransfer(dto);

      expect(mockValidateService.validate).toHaveBeenCalledWith(
        'comp-1',
        'emp-1',
        dto,
      );

      expect(mockTransferRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantCode: 'tenant-1',
          employeeId: 'emp-1',
          sourceCompanyId: 'comp-1',
          destinationCompanyId: 'comp-2',
          destinationLocationId: 'loc-1',
          status: EmployeeTransferStatus.PENDING,
          createdBy: 'user-admin',
        }),
      );

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
      expect(result.id).toBe('trans-1');
    });
  });
});
