import { EmployeeTransferStatus } from '../../../enums';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferRepository } from '../repositories/employee-transfer.repository';
import { EmployeeTransferQueryService } from './employee-transfer-query.service';

describe('EmployeeTransferQueryService', () => {
  let service: EmployeeTransferQueryService;
  let mockTransferRepo: jest.Mocked<EmployeeTransferRepository>;

  beforeEach(() => {
    mockTransferRepo = {
      findById: jest.fn(),
      findPendingByEmployeeId: jest.fn(),
      findHistoryByEmployeeId: jest.fn(),
      createAndSave: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<EmployeeTransferRepository>;

    service = new EmployeeTransferQueryService(mockTransferRepo);
  });

  describe('findPendingByEmployee', () => {
    it('should call repository to find pending transfer', async () => {
      const mockPending = {
        id: 'trans-1',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        status: EmployeeTransferStatus.PENDING,
      } as EmployeeTransferEntity;

      mockTransferRepo.findPendingByEmployeeId.mockResolvedValue(mockPending);

      const result = await service.findPendingByEmployee('tenant-1', 'emp-1');

      expect(mockTransferRepo.findPendingByEmployeeId).toHaveBeenCalledWith('tenant-1', 'emp-1');
      expect(result).toEqual(mockPending);
    });
  });

  describe('findHistoryByEmployee', () => {
    it('should call repository to find transfer history', async () => {
      const mockResult = {
        items: [{ id: 'trans-1' }] as EmployeeTransferEntity[],
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockTransferRepo.findHistoryByEmployeeId.mockResolvedValue(mockResult);

      const result = await service.findHistoryByEmployee('tenant-1', 'emp-1', {
        employeeId: 'emp-1',
        limit: 20,
        offset: 0,
      });

      expect(mockTransferRepo.findHistoryByEmployeeId).toHaveBeenCalledWith('tenant-1', 'emp-1', {
        employeeId: 'emp-1',
        limit: 20,
        offset: 0,
      });
      expect(result).toEqual(mockResult);
    });
  });
});
