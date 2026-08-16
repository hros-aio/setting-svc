import { LocationService } from '../../src/modules/location/services/location.service';
import { MasterDataStatus } from '../../src/enums';
import { Logger, NotFoundException } from '@nestjs/common';
import { LocationRepository } from '../../src/modules/location/repositories/location.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { DataSource } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { LocationEntity } from '../../src/modules/location/entities/location.entity';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';

describe('LocationService - Query Locations [US2]', () => {
  let service: LocationService;
  let mockLocationRepo: jest.Mocked<Partial<LocationRepository>>;

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    sessionId: 'sess-1',
    tenantCode: 'tenant-1',
    roles: ['admin'],
    scopes: [],
    permissions: ['location:read'],
  };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-1' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockLocationRepo = {
      findActiveLocations: jest.fn(),
      findById: jest.fn(),
    };

    service = new LocationService(
      {} as unknown as DataSource,
      {} as unknown as TransactionService,
      mockLocationRepo as unknown as LocationRepository,
      {} as unknown as CompanyRepository,
      {} as unknown as CompanySetupStepRepository,
      {} as unknown as EffectiveChangeRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return paginated active locations for company', async () => {
    const mockResult = {
      data: [
        { id: 'loc-1', name: 'Tokyo Office', status: MasterDataStatus.ACTIVE } as LocationEntity,
      ],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    (mockLocationRepo.findActiveLocations as jest.Mock).mockResolvedValue(mockResult);

    const result = await service.findActiveLocations({ page: 1, limit: 20 }, mockAuthContext);
    expect(result).toBe(mockResult);
    expect(mockLocationRepo.findActiveLocations).toHaveBeenCalledWith('tenant-1', 'comp-1', {
      page: 1,
      limit: 20,
      search: undefined,
    });
  });

  it('should return empty result and log warning if tenantId is missing', async () => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue(null);
    const warnSpy = jest
      .spyOn((service as unknown as { logger: Logger }).logger, 'warn')
      .mockImplementation();

    const result = await service.findActiveLocations({ page: 1, limit: 10 }, null);

    expect(result).toEqual({
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('missing tenantId from request context'),
    );
    expect(mockLocationRepo.findActiveLocations).not.toHaveBeenCalled();
  });

  it('should return empty result and log warning if companyId is missing', async () => {
    jest.spyOn(RequestContextService, 'current').mockReturnValue(null);
    const warnSpy = jest
      .spyOn((service as unknown as { logger: Logger }).logger, 'warn')
      .mockImplementation();

    const result = await service.findActiveLocations({ page: 1, limit: 20 }, mockAuthContext);

    expect(result).toEqual({
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('missing companyId from request context'),
    );
    expect(mockLocationRepo.findActiveLocations).not.toHaveBeenCalled();
  });

  it('should return location by id', async () => {
    const mockLoc = { id: 'loc-1', name: 'Tokyo Office' } as LocationEntity;
    (mockLocationRepo.findById as jest.Mock).mockResolvedValue(mockLoc);

    const result = await service.findById('loc-1', mockAuthContext);
    expect(result).toBe(mockLoc);
  });

  it('should throw NotFoundException if location not found', async () => {
    (mockLocationRepo.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.findById('loc-999', mockAuthContext)).rejects.toThrow(NotFoundException);
  });
});
