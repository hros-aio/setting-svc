import { PaginatedResult } from '@new-hros/libs-sql';
import { EmployeeTransferStatus } from '../../../enums';
import { QueryEmployeeTransferDto } from '../dtos/query-employee-transfer.dto';
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
    } as unknown as jest.Mocked<EmployeeTransferRepository>;

    service = new EmployeeTransferQueryService(mockTransferRepo);
  });

  describe('findPendingByEmployee', () => {
    it('should call repository to find pending transfer', async () => {
      const mockPending = {
        id: 'trans-1',
        tenantCode: 'tenant-1',
        employeeId: 'emp-1',
        status: EmployeeTransferStatus.PENDING,
      } as unknown as EmployeeTransferEntity;

      mockTransferRepo.findPendingByEmployeeId.mockResolvedValue(mockPending);

      const result = await service.findPendingByEmployee('emp-1');

      expect(mockTransferRepo.findPendingByEmployeeId).toHaveBeenCalledWith('emp-1');
      expect(result).toEqual(mockPending);
    });
  });

  describe('findHistory', () => {
    it('should call repository to find transfer history', async () => {
      const mockResult: PaginatedResult<EmployeeTransferEntity> = {
        data: [{ id: 'trans-1' }] as EmployeeTransferEntity[],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      mockTransferRepo.findHistoryByEmployeeId.mockResolvedValue(mockResult);

      const query: QueryEmployeeTransferDto = {
        employeeId: 'emp-1',
        page: 1,
        limit: 20,
      };

      const result = await service.findHistory(query);

      expect(mockTransferRepo.findHistoryByEmployeeId).toHaveBeenCalledWith('emp-1', query);
      expect(result).toEqual(mockResult);
    });
  });
});
