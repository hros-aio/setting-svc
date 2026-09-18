import { PaginatedResult } from '@new-hros/libs-sql';
import { EmployeeTransferStatus } from '../../../enums';
import { InitiateEmployeeTransferDto } from '../dtos/initiate-employee-transfer.dto';
import {
  QueryEmployeeTransferDto,
  QueryPendingTransferDto,
} from '../dtos/query-employee-transfer.dto';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferQueryService } from '../services/employee-transfer-query.service';
import { EmployeeTransferService } from '../services/employee-transfer.service';
import { EmployeeTransferController } from './employee-transfer.controller';

describe('EmployeeTransferController', () => {
  let controller: EmployeeTransferController;
  let mockTransferService: jest.Mocked<EmployeeTransferService>;
  let mockQueryService: jest.Mocked<EmployeeTransferQueryService>;

  beforeEach(() => {
    mockTransferService = {
      initiateTransfer: jest.fn(),
    } as unknown as jest.Mocked<EmployeeTransferService>;

    mockQueryService = {
      findPendingByEmployee: jest.fn(),
      findHistory: jest.fn(),
    } as unknown as jest.Mocked<EmployeeTransferQueryService>;

    controller = new EmployeeTransferController(mockTransferService, mockQueryService);
  });

  describe('initiateTransfer', () => {
    it('should call transfer service with body parameters and return created transfer entity', async () => {
      const dto: InitiateEmployeeTransferDto = {
        companyId: 'comp-1',
        employeeId: 'emp-1',
        destinationCompanyId: 'comp-2',
        effectiveAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      };

      const mockResponse = {
        id: 'trans-1',
        tenantCode: 'tenant-1',
        employeeId: 'emp-1',
        sourceCompanyId: 'comp-1',
        destinationCompanyId: 'comp-2',
        status: EmployeeTransferStatus.PENDING,
      } as unknown as EmployeeTransferEntity;

      mockTransferService.initiateTransfer.mockResolvedValue(mockResponse);

      const result = await controller.initiateTransfer(dto);

      expect(mockTransferService.initiateTransfer).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getPendingTransfer', () => {
    it('should call query service with query parameters to retrieve pending transfer', async () => {
      const mockResponse = {
        id: 'trans-1',
        tenantCode: 'tenant-1',
        employeeId: 'emp-1',
        status: EmployeeTransferStatus.PENDING,
      } as unknown as EmployeeTransferEntity;

      mockQueryService.findPendingByEmployee.mockResolvedValue(mockResponse);

      const query: QueryPendingTransferDto = { employeeId: 'emp-1' };
      const result = await controller.getPendingTransfer(query);

      expect(mockQueryService.findPendingByEmployee).toHaveBeenCalledWith('emp-1');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getTransferHistory', () => {
    it('should call query service with query parameters to retrieve paginated transfer history', async () => {
      const mockResponse: PaginatedResult<EmployeeTransferEntity> = {
        data: [{ id: 'trans-1' }] as EmployeeTransferEntity[],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      mockQueryService.findHistory.mockResolvedValue(mockResponse);

      const query: QueryEmployeeTransferDto = { employeeId: 'emp-1', page: 1, limit: 20 };
      const result = await controller.getTransferHistory(query);

      expect(mockQueryService.findHistory).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResponse);
    });
  });
});
