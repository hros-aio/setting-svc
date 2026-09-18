import { RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { EntityManager, Repository } from 'typeorm';
import { EmployeeTransferStatus } from '../../../enums';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferRepository } from './employee-transfer.repository';

describe('EmployeeTransferRepository', () => {
  let repository: EmployeeTransferRepository;
  let mockTypeOrmRepo: jest.Mocked<Partial<Repository<EmployeeTransferEntity>>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockManager: jest.Mocked<Partial<EntityManager>>;

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');

    mockTypeOrmRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((dto) => dto as EmployeeTransferEntity),
      save: jest
        .fn()
        .mockImplementation(
          async (entity) => ({ id: 'trans-1', ...entity }) as EmployeeTransferEntity,
        ),
    };

    mockManager = {
      getRepository: jest
        .fn()
        .mockReturnValue(mockTypeOrmRepo as unknown as Repository<EmployeeTransferEntity>),
    };

    mockTxService = {
      getManager: jest.fn().mockReturnValue(mockManager as unknown as EntityManager),
    };

    repository = new EmployeeTransferRepository(mockTxService as unknown as TransactionService);
    jest
      .spyOn(repository as unknown as { tenantCode: string }, 'tenantCode', 'get')
      .mockReturnValue('tenant-1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findPendingByEmployeeId', () => {
    it('should query pending transfer for an employee', async () => {
      const mockEntity = {
        id: 'trans-1',
        tenantCode: 'tenant-1',
        employeeId: 'emp-1',
        status: EmployeeTransferStatus.PENDING,
      } as EmployeeTransferEntity;

      (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockEntity);

      const result = await repository.findPendingByEmployeeId('emp-1');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: {
          tenantCode: 'tenant-1',
          employeeId: 'emp-1',
          status: EmployeeTransferStatus.PENDING,
        },
        relations: [
          'sourceCompany',
          'destinationCompany',
          'destinationLocation',
          'destinationDepartment',
          'destinationGrade',
          'destinationJobTitle',
        ],
      });
      expect(result).toEqual(mockEntity);
    });
  });

  describe('findHistoryByEmployeeId', () => {
    it('should return paginated transfer history', async () => {
      const mockItems = [
        { id: 'trans-1', tenantCode: 'tenant-1', employeeId: 'emp-1' },
      ] as EmployeeTransferEntity[];

      (mockTypeOrmRepo.findAndCount as jest.Mock).mockResolvedValue([mockItems, 1]);

      const result = await repository.findHistoryByEmployeeId('emp-1', {
        page: 1,
        limit: 10,
      });

      expect(mockTypeOrmRepo.findAndCount).toHaveBeenCalled();
      expect(result.data).toEqual(mockItems);
      expect(result.total).toBe(1);
    });
  });
});
