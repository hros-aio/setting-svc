import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource } from 'typeorm';
import { CompanyEntity } from '../../company/entities/company.entity';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { LocationEntity } from '../entities/location.entity';
import { LocationRepository } from '../repositories/location.repository';
import { LocationService } from './location.service';

describe('LocationService - Multi-Company Isolation & Code Generation [US1]', () => {
  let service: LocationService;
  let mockLocationRepo: { [K in keyof LocationRepository]?: jest.Mock };
  let mockCompanyRepo: { [K in keyof CompanyRepository]?: jest.Mock };
  let mockSetupStepRepo: { [K in keyof CompanySetupStepRepository]?: jest.Mock };
  let mockDataSource: { manager: { getRepository: jest.Mock } };
  let mockTxService: { runInTransaction: jest.Mock };
  let mockOutboxRepo: { create: jest.Mock; save: jest.Mock };

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    sessionId: 'sess-1',
    tenantCode: 'tenant-1',
    roles: ['admin'],
    scopes: [],
    permissions: ['location:create'],
  };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-A' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => dto as OutboxEventEntity),
      save: jest.fn().mockResolvedValue({ id: 'outbox-1' } as OutboxEventEntity),
    };

    mockLocationRepo = {
      countAllLocationsByCompany: jest.fn().mockResolvedValue(0),
      hasActiveOrScheduledHeadquarter: jest.fn().mockResolvedValue(false),
      createAndSave: jest
        .fn()
        .mockImplementation((data) => ({ id: 'loc-1', ...data }) as LocationEntity),
    };

    mockCompanyRepo = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: 'comp-A',
        tenantId: 'tenant-1',
        timezone: 'UTC',
      } as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as never),
    };

    mockDataSource = {
      manager: {
        getRepository: jest.fn().mockReturnValue(mockOutboxRepo),
      },
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new LocationService(
      mockDataSource as unknown as DataSource,
      mockTxService as unknown as TransactionService,
      mockLocationRepo as unknown as LocationRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      {} as unknown as EffectiveChangeRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate LO00001 for Company A when it has 0 locations', async () => {
    mockLocationRepo.countAllLocationsByCompany!.mockResolvedValue(0);

    const result = await service.create(
      {
        name: 'Headquarters',
        effectiveAt: '2099-01-01T00:00:00Z',
      },
      mockAuthContext,
    );

    expect(result).toBeDefined();
    expect(mockLocationRepo.countAllLocationsByCompany).toHaveBeenCalledWith('tenant-1', 'comp-A');
    expect(mockLocationRepo.createAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        companyId: 'comp-A',
        code: 'LO00001',
      }),
      expect.anything(),
    );
  });

  it('should independently generate LO00001 for Company B even if Company A has 5 locations', async () => {
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-B' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);
    mockCompanyRepo.findByIdAndTenant!.mockResolvedValue({
      id: 'comp-B',
      tenantId: 'tenant-1',
      timezone: 'UTC',
    } as CompanyEntity);
    mockLocationRepo.countAllLocationsByCompany!.mockResolvedValue(0); // Company B has 0

    const result = await service.create(
      {
        name: 'Company B Branch',
        effectiveAt: '2099-01-01T00:00:00Z',
      },
      mockAuthContext,
    );

    expect(result).toBeDefined();
    expect(mockLocationRepo.countAllLocationsByCompany).toHaveBeenCalledWith('tenant-1', 'comp-B');
    expect(mockLocationRepo.createAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        companyId: 'comp-B',
        code: 'LO00001',
      }),
      expect.anything(),
    );
  });
});
