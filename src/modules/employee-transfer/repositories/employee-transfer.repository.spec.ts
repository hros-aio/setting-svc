import { EntityManager, Repository } from 'typeorm';
import { EmployeeTransferStatus } from '../../../enums';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferRepository } from './employee-transfer.repository';

describe('EmployeeTransferRepository', () => {
  let repository: EmployeeTransferRepository;
  let mockInnerRepo: jest.Mocked<Repository<EmployeeTransferEntity>>;
  let mockEntityManager: jest.Mocked<EntityManager>;

  beforeEach(() => {
    mockInnerRepo = {
      create: jest.fn().mockImplementation((entity: unknown) => entity),
      save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmployeeTransferEntity>>;

    mockEntityManager = {
      getRepository: jest.fn().mockReturnValue(mockInnerRepo),
    } as unknown as jest.Mocked<EntityManager>;

    repository = new EmployeeTransferRepository(mockInnerRepo);
  });

  describe('findById', () => {
    it('should find transfer by tenantId and id', async () => {
      const mockEntity = {
        id: 'trans-1',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        status: EmployeeTransferStatus.PENDING,
      } as EmployeeTransferEntity;

      (mockInnerRepo.findOne as jest.Mock).mockResolvedValue(mockEntity);

      const result = await repository.findById('tenant-1', 'trans-1');

      expect(mockInnerRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'trans-1', tenantId: 'tenant-1' },
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

  describe('findPendingByEmployeeId', () => {
    it('should query pending transfer for an employee', async () => {
      const mockEntity = {
        id: 'trans-1',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        status: EmployeeTransferStatus.PENDING,
      } as EmployeeTransferEntity;

      (mockInnerRepo.findOne as jest.Mock).mockResolvedValue(mockEntity);

      const result = await repository.findPendingByEmployeeId(
        'tenant-1',
        'emp-1',
        mockEntityManager,
      );

      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(EmployeeTransferEntity);
      expect(mockInnerRepo.findOne).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
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
        { id: 'trans-1', tenantId: 'tenant-1', employeeId: 'emp-1' },
      ] as EmployeeTransferEntity[];

      (mockInnerRepo.findAndCount as jest.Mock).mockResolvedValue([mockItems, 1]);

      const result = await repository.findHistoryByEmployeeId('tenant-1', 'emp-1', {
        limit: 10,
        offset: 0,
      });

      expect(mockInnerRepo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', employeeId: 'emp-1' },
        relations: [
          'sourceCompany',
          'destinationCompany',
          'destinationLocation',
          'destinationDepartment',
          'destinationGrade',
          'destinationJobTitle',
        ],
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({
        items: mockItems,
        total: 1,
        limit: 10,
        offset: 0,
      });
    });
  });

  describe('createAndSave and save', () => {
    it('should create and save entity', async () => {
      const data = { employeeId: 'emp-1', status: EmployeeTransferStatus.PENDING };
      const result = await repository.createAndSave(data);

      expect(mockInnerRepo.create).toHaveBeenCalledWith(data);
      expect(mockInnerRepo.save).toHaveBeenCalledWith(data);
      expect(result).toEqual(data);
    });

    it('should save existing entity', async () => {
      const entity = {
        id: 'trans-1',
        status: EmployeeTransferStatus.COMPLETED,
      } as EmployeeTransferEntity;
      const result = await repository.save(entity, mockEntityManager);

      expect(mockInnerRepo.save).toHaveBeenCalledWith(entity);
      expect(result).toEqual(entity);
    });
  });
});
