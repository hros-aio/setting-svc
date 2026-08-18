import { AuthContext } from '@new-hros/libs-core';
import { ChangeOperation, MasterDataStatus, PocType } from '../../../enums';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { CreatePocDto } from '../dtos/create-poc.dto';
import { DeactivatePocDto } from '../dtos/deactivate-poc.dto';
import { QueryPocDto } from '../dtos/query-poc.dto';
import { ReplacePocDto } from '../dtos/replace-poc.dto';
import { PocEntity } from '../entities/poc.entity';
import { ActivePocResponse, PocQueryService } from '../services/poc-query.service';
import { PocService } from '../services/poc.service';
import { PocController } from './poc.controller';

describe('PocController', () => {
  let controller: PocController;
  let mockPocService: jest.Mocked<PocService>;
  let mockPocQueryService: jest.Mocked<PocQueryService>;

  const authContext: AuthContext = {
    tenantCode: 'tenant-123',
    userId: 'user-admin',
    roles: ['Administrator'],
    sessionId: 'session-123',
    scopes: [],
    permissions: ['poc:create', 'poc:update', 'poc:deactivate', 'poc:read'],
  };

  beforeEach(() => {
    mockPocService = {
      create: jest.fn(),
      replace: jest.fn(),
      deactivate: jest.fn(),
    } as unknown as jest.Mocked<PocService>;

    mockPocQueryService = {
      findActiveByCompany: jest.fn(),
      findHistoryByCompany: jest.fn(),
    } as unknown as jest.Mocked<PocQueryService>;

    controller = new PocController(mockPocService, mockPocQueryService);
  });

  describe('create', () => {
    it('should delegate to pocService.create', async () => {
      const dto: CreatePocDto = {
        pocType: PocType.HR_HEAD,
        employeeId: '550e8400-e29b-41d4-a716-446655440000',
        effectiveAt: '2026-08-25T00:00:00.000Z',
      };

      const createdPoc = {
        id: 'poc-1',
        pocType: PocType.HR_HEAD,
        status: MasterDataStatus.SCHEDULED,
      } as PocEntity;

      mockPocService.create.mockResolvedValue(createdPoc);

      const result = await controller.create('company-123', dto, authContext);

      expect(mockPocService.create).toHaveBeenCalledWith('company-123', dto, authContext);
      expect(result).toEqual(createdPoc);
    });
  });

  describe('replace', () => {
    it('should delegate to pocService.replace', async () => {
      const dto: ReplacePocDto = {
        newEmployeeId: '660e8400-e29b-41d4-a716-446655440111',
        effectiveAt: '2026-08-25T00:00:00.000Z',
        reason: 'Succession',
      };

      const scheduledChange = {
        id: 'change-1',
        operation: ChangeOperation.UPDATE,
      } as EffectiveChangeEntity;

      mockPocService.replace.mockResolvedValue(scheduledChange);

      const result = await controller.replace('company-123', 'poc-1', dto, authContext);

      expect(mockPocService.replace).toHaveBeenCalledWith('company-123', 'poc-1', dto, authContext);
      expect(result).toEqual(scheduledChange);
    });
  });

  describe('deactivate', () => {
    it('should delegate to pocService.deactivate', async () => {
      const dto: DeactivatePocDto = {
        effectiveAt: '2026-08-30T00:00:00.000Z',
        reason: 'Restructuring',
      };

      const scheduledChange = {
        id: 'change-deact',
        operation: ChangeOperation.DEACTIVATE,
      } as EffectiveChangeEntity;

      mockPocService.deactivate.mockResolvedValue(scheduledChange);

      const result = await controller.deactivate('company-123', 'poc-1', dto, authContext);

      expect(mockPocService.deactivate).toHaveBeenCalledWith(
        'company-123',
        'poc-1',
        dto,
        authContext,
      );
      expect(result).toEqual(scheduledChange);
    });
  });

  describe('findActive', () => {
    it('should delegate to pocQueryService.findActiveByCompany', async () => {
      const activeList: ActivePocResponse[] = [
        {
          id: 'poc-1',
          pocType: 'HR_HEAD',
          employeeId: 'emp-1',
          isHolderInactive: false,
          status: 'active',
          effectiveAt: new Date(),
          hasPendingChange: false,
        },
      ];

      mockPocQueryService.findActiveByCompany.mockResolvedValue(activeList);

      const result = await controller.findActive('company-123', authContext);

      expect(mockPocQueryService.findActiveByCompany).toHaveBeenCalledWith(
        'company-123',
        authContext,
      );
      expect(result).toEqual(activeList);
    });
  });

  describe('findHistory', () => {
    it('should delegate to pocQueryService.findHistoryByCompany', async () => {
      const query: QueryPocDto = { page: 1, limit: 10 };
      const paginatedResult = {
        items: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 1 },
      };

      mockPocQueryService.findHistoryByCompany.mockResolvedValue(paginatedResult);

      const result = await controller.findHistory('company-123', query, authContext);

      expect(mockPocQueryService.findHistoryByCompany).toHaveBeenCalledWith(
        'company-123',
        query,
        authContext,
      );
      expect(result).toEqual(paginatedResult);
    });
  });
});
