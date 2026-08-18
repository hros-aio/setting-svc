import { AuthContext } from '@new-hros/libs-core';
import { MasterDataStatus, PocType } from '../../../enums';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { EmployeeReferenceEntity } from '../../employee-reference/entities/employee-reference.entity';
import { EmployeeReferenceRepository } from '../../employee-reference/repositories/employee-reference.repository';
import { QueryPocDto } from '../dtos/query-poc.dto';
import { PocEntity } from '../entities/poc.entity';
import { PocRepository } from '../repositories/poc.repository';
import { PocQueryService } from './poc-query.service';

describe('PocQueryService', () => {
  let service: PocQueryService;
  let mockPocRepo: jest.Mocked<PocRepository>;
  let mockEmployeeRefRepo: jest.Mocked<EmployeeReferenceRepository>;
  let mockEffectiveChangeRepo: jest.Mocked<EffectiveChangeRepository>;

  const authContext: AuthContext = {
    tenantCode: 'tenant-123',
    userId: 'user-1',
    roles: ['Administrator'],
    sessionId: 'session-123',
    scopes: [],
    permissions: ['poc:read'],
  };

  beforeEach(() => {
    mockPocRepo = {
      findActiveByCompany: jest.fn(),
      findHistory: jest.fn(),
    } as unknown as jest.Mocked<PocRepository>;

    mockEmployeeRefRepo = {
      findByEmployeeIds: jest.fn(),
    } as unknown as jest.Mocked<EmployeeReferenceRepository>;

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn(),
    } as unknown as jest.Mocked<EffectiveChangeRepository>;

    service = new PocQueryService(mockPocRepo, mockEmployeeRefRepo, mockEffectiveChangeRepo);
  });

  describe('findActiveByCompany', () => {
    it('should return empty list when no active PoCs exist', async () => {
      mockPocRepo.findActiveByCompany.mockResolvedValue([]);

      const result = await service.findActiveByCompany('company-123', authContext);

      expect(result).toEqual([]);
    });

    it('should return active PoCs enriched with employee details and pending change info', async () => {
      const activePocs = [
        {
          id: 'poc-1',
          tenantId: 'tenant-123',
          companyId: 'company-123',
          pocType: PocType.HR_HEAD,
          employeeId: 'emp-1',
          status: MasterDataStatus.ACTIVE,
          effectiveAt: new Date('2026-08-01'),
        },
      ] as PocEntity[];

      const employeeRefs = [
        {
          id: 'ref-1',
          tenantId: 'tenant-123',
          companyId: 'company-123',
          employeeId: 'emp-1',
          employeeNumber: 'EMP-001',
          displayName: 'Jane Doe',
          employmentStatus: 'ACTIVE',
        },
      ] as EmployeeReferenceEntity[];

      const pendingChange = {
        id: 'change-1',
        operation: 'UPDATE',
        effectiveAt: new Date('2026-08-25'),
        payload: { newEmployeeId: 'emp-2' },
      } as unknown as EffectiveChangeEntity;

      mockPocRepo.findActiveByCompany.mockResolvedValue(activePocs);
      mockEmployeeRefRepo.findByEmployeeIds.mockResolvedValue(employeeRefs);
      mockEffectiveChangeRepo.findPendingChange.mockResolvedValue(pendingChange);

      const result = await service.findActiveByCompany('company-123', authContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'poc-1',
          pocType: PocType.HR_HEAD,
          employeeId: 'emp-1',
          displayName: 'Jane Doe',
          employeeNumber: 'EMP-001',
          isHolderInactive: false,
          hasPendingChange: true,
          pendingChange: {
            id: 'change-1',
            changeType: 'UPDATE',
            effectiveAt: pendingChange.effectiveAt,
            newEmployeeId: 'emp-2',
          },
        }),
      );
    });

    it('should flag isHolderInactive=true when employee is terminated or not found', async () => {
      const activePocs = [
        {
          id: 'poc-1',
          pocType: PocType.FINANCE_HEAD,
          employeeId: 'emp-term',
          status: MasterDataStatus.ACTIVE,
          effectiveAt: new Date('2026-08-01'),
        },
      ] as PocEntity[];

      const employeeRefs = [
        {
          employeeId: 'emp-term',
          displayName: 'Former Employee',
          employmentStatus: 'TERMINATED',
        },
      ] as EmployeeReferenceEntity[];

      mockPocRepo.findActiveByCompany.mockResolvedValue(activePocs);
      mockEmployeeRefRepo.findByEmployeeIds.mockResolvedValue(employeeRefs);
      mockEffectiveChangeRepo.findPendingChange.mockResolvedValue(null);

      const result = await service.findActiveByCompany('company-123', authContext);

      expect(result[0].isHolderInactive).toBe(true);
      expect(result[0].hasPendingChange).toBe(false);
    });
  });

  describe('findHistoryByCompany', () => {
    it('should return paginated history with resolved employee details', async () => {
      const historyPocs = [
        {
          id: 'poc-old',
          tenantId: 'tenant-123',
          companyId: 'company-123',
          pocType: PocType.IT_HEAD,
          employeeId: 'emp-1',
          status: MasterDataStatus.INACTIVE,
          effectiveAt: new Date('2026-07-01'),
          createdAt: new Date('2026-06-15'),
          updatedAt: new Date('2026-07-01'),
        },
      ] as PocEntity[];

      mockPocRepo.findHistory.mockResolvedValue({
        items: historyPocs,
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      mockEmployeeRefRepo.findByEmployeeIds.mockResolvedValue([
        {
          employeeId: 'emp-1',
          displayName: 'John Smith',
        } as EmployeeReferenceEntity,
      ]);

      const query: QueryPocDto = { page: 1, limit: 20 };
      const result = await service.findHistoryByCompany('company-123', query, authContext);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].displayName).toBe('John Smith');
      expect(result.meta.total).toBe(1);
    });
  });
});
