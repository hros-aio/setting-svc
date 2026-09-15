import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { Location, TransactionService } from '@new-hros/libs-sql';
import { OutboxEventRepository } from '../../src/modules/company/repositories/outbox-event.repository';
import { MasterDataStatus, SetupStepType } from '../../src/enums';
import { CompanySetupStepEntity } from '../../src/modules/company/entities/company-setup-step.entity';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';
import { LocationRepository } from '../../src/modules/location/repositories/location.repository';
import { LocationService } from '../../src/modules/location/services/location.service';

describe('LocationService - Create Location [US1]', () => {
  let service: LocationService;
  let mockLocationRepo: jest.Mocked<Partial<LocationRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockSetupStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
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
      .mockReturnValue({ companyId: 'comp-1' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxEventRepo = {
      create: jest.fn().mockResolvedValue({ id: 'outbox-1' } as unknown as OutboxEventEntity),
    };

    mockLocationRepo = {
      findByCode: jest.fn(),
      countAllLocationsByCompany: jest.fn().mockResolvedValue(0),
      hasActiveOrScheduledHeadquarter: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(
          (data) => Promise.resolve({ id: 'loc-1', ...data }) as Promise<Location>,
        ),
    };

    mockCompanyRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'comp-1',
        timezone: 'UTC',
      } as unknown as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as CompanySetupStepEntity),
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation(async (cb) => cb()),
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

  it('should reject if effectiveAt is in the past or earlier than end of current business day', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    await expect(
      service.create(
        {
          name: 'Tokyo HQ',
          effectiveAt: pastDate,
        },
        'comp-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should auto-generate code LO00001 for the first location', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockLocationRepo.countAllLocationsByCompany as jest.Mock).mockResolvedValue(0);
    (mockLocationRepo.hasActiveOrScheduledHeadquarter as jest.Mock).mockResolvedValue(false);

    const result = await service.create(
      {
        name: 'Tokyo HQ',
        effectiveAt: futureDate,
      },
      'comp-1',
    );

    expect(result.code).toBe('LO00001');
    expect(mockLocationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'LO00001' }),
    );
  });

  it('should auto-generate incremented code (e.g. LO00005) when existing locations exist', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockLocationRepo.countAllLocationsByCompany as jest.Mock).mockResolvedValue(4);
    (mockLocationRepo.hasActiveOrScheduledHeadquarter as jest.Mock).mockResolvedValue(false);

    const result = await service.create(
      {
        name: 'Osaka Branch',
        effectiveAt: futureDate,
      },
      'comp-1',
    );

    expect(result.code).toBe('LO00005');
  });

  it('should reject if headquarter is already assigned', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockLocationRepo.countAllLocationsByCompany as jest.Mock).mockResolvedValue(0);
    (mockLocationRepo.hasActiveOrScheduledHeadquarter as jest.Mock).mockResolvedValue(true);

    await expect(
      service.create(
        {
          name: 'Tokyo HQ',
          isHeadquarter: true,
          effectiveAt: futureDate,
        },
        'comp-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should successfully create location in scheduled status and complete setup step', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockLocationRepo.countAllLocationsByCompany as jest.Mock).mockResolvedValue(0);
    (mockLocationRepo.hasActiveOrScheduledHeadquarter as jest.Mock).mockResolvedValue(false);

    const result = await service.create(
      {
        name: 'Tokyo HQ',
        isHeadquarter: true,
        effectiveAt: futureDate,
      },
      'comp-1',
    );

    expect(result.id).toBe('loc-1');
    expect(result.code).toBe('LO00001');
    expect(result.status).toBe(MasterDataStatus.SCHEDULED);
    expect(mockSetupStepRepo.markStepCompleted).toHaveBeenCalledWith({
      companyId: 'comp-1',
      stepType: SetupStepType.LOCATION,
      completedBy: 'user-1',
    });
    expect(mockOutboxEventRepo.create).toHaveBeenCalled();
  });
});
