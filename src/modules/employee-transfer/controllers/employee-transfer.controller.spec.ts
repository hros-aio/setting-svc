import { AuthContext } from '@new-hros/libs-core';
import { EmployeeTransferStatus } from '../../../enums';
import { InitiateEmployeeTransferDto } from '../dtos/initiate-employee-transfer.dto';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferQueryService } from '../services/employee-transfer-query.service';
import { EmployeeTransferService } from '../services/employee-transfer.service';
import { EmployeeTransferController } from './employee-transfer.controller';

describe('EmployeeTransferController', () => {
  let controller: EmployeeTransferController;
  let mockTransferService: jest.Mocked<EmployeeTransferService>;
  let mockQueryService: jest.Mocked<EmployeeTransferQueryService>;

  const authContext = {
    tenantCode: 'tenant-1',
    userId: 'admin-1',
  } as unknown as AuthContext;

  beforeEach(() => {
    mockTransferService = {
      initiateTransfer: jest.fn(),
    } as unknown as jest.Mocked<EmployeeTransferService>;

    mockQueryService = {
      findPendingByEmployee: jest.fn(),
      findHistoryByEmployee: jest.fn(),
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
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        sourceCompanyId: 'comp-1',
        destinationCompanyId: 'comp-2',
        status: EmployeeTransferStatus.PENDING,
      } as EmployeeTransferEntity;

      mockTransferService.initiateTransfer.mockResolvedValue(mockResponse);

      const result = await controller.initiateTransfer(dto, authContext);

      expect(mockTransferService.initiateTransfer).toHaveBeenCalledWith(
        'tenant-1',
        'comp-1',
        'emp-1',
        dto,
        authContext,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getPendingTransfer', () => {
    it('should call query service with query parameters to retrieve pending transfer', async () => {
      const mockResponse = {
        id: 'trans-1',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        status: EmployeeTransferStatus.PENDING,
      } as EmployeeTransferEntity;

      mockQueryService.findPendingByEmployee.mockResolvedValue(mockResponse);

      const result = await controller.getPendingTransfer({ employeeId: 'emp-1' }, authContext);

      expect(mockQueryService.findPendingByEmployee).toHaveBeenCalledWith('tenant-1', 'emp-1');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getTransferHistory', () => {
    it('should call query service with query parameters to retrieve paginated transfer history', async () => {
      const mockResponse = {
        items: [{ id: 'trans-1' }] as EmployeeTransferEntity[],
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockQueryService.findHistoryByEmployee.mockResolvedValue(mockResponse);

      const result = await controller.getTransferHistory(
        { employeeId: 'emp-1', limit: 20, offset: 0 },
        authContext,
      );

      expect(mockQueryService.findHistoryByEmployee).toHaveBeenCalledWith('tenant-1', 'emp-1', {
        employeeId: 'emp-1',
        limit: 20,
        offset: 0,
      });
      expect(result).toEqual(mockResponse);
    });
  });
});
