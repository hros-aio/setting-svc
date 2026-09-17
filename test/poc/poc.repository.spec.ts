import { RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { EntityManager, Repository } from 'typeorm';
import { MasterDataStatus } from '../../src/enums';
import { PocEntity } from '../../src/modules/poc/entities/poc.entity';
import { PocRepository } from '../../src/modules/poc/repositories/poc.repository';

describe('PocRepository', () => {
  let repository: PocRepository;
  let mockTypeOrmRepo: jest.Mocked<Partial<Repository<PocEntity>>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockManager: jest.Mocked<Partial<EntityManager>>;

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');

    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto as PocEntity),
      save: jest
        .fn()
        .mockImplementation(async (entity) => ({ id: 'poc-1', ...entity }) as PocEntity),
    };

    mockManager = {
      getRepository: jest.fn().mockReturnValue(mockTypeOrmRepo as unknown as Repository<PocEntity>),
    };

    mockTxService = {
      getManager: jest.fn().mockReturnValue(mockManager as unknown as EntityManager),
    };

    repository = new PocRepository(mockTxService as unknown as TransactionService);
    jest
      .spyOn(repository as unknown as { tenantCode: string }, 'tenantCode', 'get')
      .mockReturnValue('tenant-1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findById', () => {
    it('should find Poc by id', async () => {
      const mockPoc = {
        id: 'poc-1',
        tenantId: 'tenant-1',
        companyId: 'company-1',
        pocType: 'HR_HEAD',
      } as unknown as PocEntity;
      (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockPoc);

      const result = await repository.findById('poc-1');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'poc-1', tenantCode: 'tenant-1' },
      });
      expect(result).toEqual(mockPoc);
    });
  });

  describe('findByCompanyAndType', () => {
    it('should find non-inactive Poc by company and pocType', async () => {
      const mockPoc = {
        id: 'poc-1',
        tenantId: 'tenant-1',
        companyId: 'company-1',
        pocType: 'HR_HEAD',
        status: MasterDataStatus.ACTIVE,
      } as unknown as PocEntity;
      (mockTypeOrmRepo.findOne as jest.Mock).mockResolvedValue(mockPoc);

      const result = await repository.findByCompanyAndType('company-1', 'HR_HEAD');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalled();
      expect(result).toEqual(mockPoc);
    });
  });

  describe('findActiveByCompany', () => {
    it('should query only active Poc records ordered by pocType', async () => {
      const mockList = [{ id: 'poc-1', status: MasterDataStatus.ACTIVE }] as PocEntity[];
      (mockTypeOrmRepo.find as jest.Mock).mockResolvedValue(mockList);

      const result = await repository.findActiveByCompany('company-1');

      expect(mockTypeOrmRepo.find).toHaveBeenCalled();
      expect(result).toEqual(mockList);
    });
  });

  describe('hasActiveOrScheduled', () => {
    it('should return true if active or scheduled Poc exists', async () => {
      (mockTypeOrmRepo.count as jest.Mock).mockResolvedValue(1);

      const result = await repository.hasActiveOrScheduled('company-1');

      expect(mockTypeOrmRepo.count).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if no active or scheduled Poc exists', async () => {
      (mockTypeOrmRepo.count as jest.Mock).mockResolvedValue(0);

      const result = await repository.hasActiveOrScheduled('company-1');

      expect(result).toBe(false);
    });
  });
});
