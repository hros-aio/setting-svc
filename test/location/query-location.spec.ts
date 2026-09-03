import { LocationService } from '../../src/modules/location/services/location.service';
import { MasterDataStatus } from '../../src/enums';
import { Logger, NotFoundException } from '@nestjs/common';
import { LocationRepository } from '../../src/modules/location/repositories/location.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { DataSource } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { Location } from '@new-hros/libs-sql';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';

describe('LocationService - Query Locations [US2]', () => {
  let service: LocationService;
  let mockLocationRepo: jest.Mocked<Partial<LocationRepository>>;

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
      data: [{ id: 'loc-1', name: 'Tokyo Office', status: MasterDataStatus.ACTIVE } as Location],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    (mockLocationRepo.findActiveLocations as jest.Mock).mockResolvedValue(mockResult);

    const result = await service.findActiveLocations({ page: 1, limit: 20 });
    expect(result).toBe(mockResult);
    expect(mockLocationRepo.findActiveLocations).toHaveBeenCalledWith('comp-1', {
      page: 1,
      limit: 20,
      search: undefined,
    });
  });

  it('should return location by id', async () => {
    const mockLoc = { id: 'loc-1', name: 'Tokyo Office' } as Location;
    (mockLocationRepo.findById as jest.Mock).mockResolvedValue(mockLoc);

    const result = await service.findById('loc-1');
    expect(result).toBe(mockLoc);
    expect(mockLocationRepo.findById).toHaveBeenCalledWith('loc-1', { required: true });
  });
});
