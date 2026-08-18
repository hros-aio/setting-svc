import { Repository } from 'typeorm';
import { MasterDataStatus } from '../../src/enums';
import { PocEntity } from '../../src/modules/poc/entities/poc.entity';
import { PocRepository } from '../../src/modules/poc/repositories/poc.repository';

describe('PocRepository', () => {
  let repository: PocRepository;
  let mockRepo: jest.Mocked<Repository<PocEntity>>;

  beforeEach(() => {
    mockRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn().mockImplementation((dto: unknown) => dto),
      save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<PocEntity>>;

    repository = new PocRepository(mockRepo);
  });

  describe('findById', () => {
    it('should find Poc by tenantId, companyId, and id', async () => {
      const mockPoc = {
        id: 'poc-1',
        tenantId: 'tenant-1',
        companyId: 'company-1',
        pocType: 'HR_HEAD',
      } as PocEntity;
      mockRepo.findOne.mockResolvedValue(mockPoc);

      const result = await repository.findById('tenant-1', 'company-1', 'poc-1');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'poc-1', tenantId: 'tenant-1', companyId: 'company-1' },
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
      } as PocEntity;
      mockRepo.findOne.mockResolvedValue(mockPoc);

      const result = await repository.findByCompanyAndType('tenant-1', 'company-1', 'HR_HEAD');

      expect(mockRepo.findOne).toHaveBeenCalled();
      expect(result).toEqual(mockPoc);
    });
  });

  describe('findActiveByCompany', () => {
    it('should query only active Poc records ordered by pocType', async () => {
      const mockList = [{ id: 'poc-1', status: MasterDataStatus.ACTIVE }] as PocEntity[];
      mockRepo.find.mockResolvedValue(mockList);

      const result = await repository.findActiveByCompany('tenant-1', 'company-1');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          companyId: 'company-1',
          status: MasterDataStatus.ACTIVE,
        },
        order: { pocType: 'ASC' },
      });
      expect(result).toEqual(mockList);
    });
  });

  describe('hasActiveOrScheduled', () => {
    it('should return true if active or scheduled Poc exists', async () => {
      mockRepo.count.mockResolvedValue(1);

      const result = await repository.hasActiveOrScheduled('tenant-1', 'company-1');

      expect(mockRepo.count).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if no active or scheduled Poc exists', async () => {
      mockRepo.count.mockResolvedValue(0);

      const result = await repository.hasActiveOrScheduled('tenant-1', 'company-1');

      expect(result).toBe(false);
    });
  });
});
