import { RequestContextService } from '@new-hros/libs-core';
import { Location, TransactionService } from '@new-hros/libs-sql';
import { CompanyEntity } from '../../company/entities/company.entity';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { OutboxEventRepository } from '../../company/repositories/outbox-event.repository';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { LocationRepository } from '../repositories/location.repository';
import { LocationService } from './location.service';

describe('LocationService - Multi-Company Isolation & Code Generation [US1]', () => {
  let service: LocationService;
  let mockLocationRepo: { [K in keyof LocationRepository]?: jest.Mock };
  let mockCompanyRepo: { [K in keyof CompanyRepository]?: jest.Mock };
  let mockSetupStepRepo: { [K in keyof CompanySetupStepRepository]?: jest.Mock };
  let mockTxService: { runInTransaction: jest.Mock };
  let mockOutboxEventRepo: { create: jest.Mock };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-1',
      sessionId: 'sess-1',
      tenantCode: 'tenant-1',
      roles: ['admin'],
      scopes: [],
      permissions: ['location:create'],
    });
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-A' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxEventRepo = {
      create: jest.fn().mockResolvedValue({ id: 'outbox-1' } as unknown as OutboxEventEntity),
    };

    mockLocationRepo = {
      countAllLocationsByCompany: jest.fn().mockResolvedValue(0),
      hasActiveOrScheduledHeadquarter: jest.fn().mockResolvedValue(false),
      create: jest
        .fn()
        .mockImplementation(
          (data) => Promise.resolve({ id: 'loc-1', ...data }) as Promise<Location>,
        ),
    };

    mockCompanyRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'comp-A',
        timezone: 'UTC',
      } as unknown as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as never),
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new LocationService(
      mockTxService as unknown as TransactionService,
      mockOutboxEventRepo as unknown as OutboxEventRepository,
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
      'comp-A',
    );

    expect(result).toBeDefined();
    expect(mockLocationRepo.countAllLocationsByCompany).toHaveBeenCalledWith('comp-A');
    expect(mockLocationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'LO00001',
      }),
    );
  });

  it('should independently generate LO00001 for Company B even if Company A has 5 locations', async () => {
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-B' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);
    mockCompanyRepo.findById!.mockResolvedValue({
      id: 'comp-B',
      timezone: 'UTC',
    } as unknown as CompanyEntity);
    mockLocationRepo.countAllLocationsByCompany!.mockResolvedValue(0); // Company B has 0

    const result = await service.create(
      {
        name: 'Company B Branch',
        effectiveAt: '2099-01-01T00:00:00Z',
      },
      'comp-B',
    );

    expect(result).toBeDefined();
    expect(mockLocationRepo.countAllLocationsByCompany).toHaveBeenCalledWith('comp-B');
    expect(mockLocationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'LO00001',
      }),
    );
  });
});
