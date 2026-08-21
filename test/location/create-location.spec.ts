import { BadRequestException, ConflictException } from '@nestjs/common';
import { LocationService } from '../../src/modules/location/services/location.service';
import { MasterDataStatus, SetupStepType } from '../../src/enums';
import { LocationRepository } from '../../src/modules/location/repositories/location.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { Location } from '@new-hros/libs-sql';
import { CompanySetupStepEntity } from '../../src/modules/company/entities/company-setup-step.entity';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';

describe('LocationService - Create Location [US1]', () => {
  let service: LocationService;
  let mockLocationRepo: jest.Mocked<Partial<LocationRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockSetupStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;
  let mockDataSource: jest.Mocked<Partial<DataSource>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockOutboxRepo: jest.Mocked<Partial<Repository<OutboxEventEntity>>>;

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
      .mockReturnValue({ companyId: 'comp-1' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => dto as OutboxEventEntity),
      save: jest.fn().mockResolvedValue({ id: 'outbox-1' } as OutboxEventEntity),
    };

    mockLocationRepo = {
      findByCode: jest.fn(),
      countAllLocationsByCompany: jest.fn().mockResolvedValue(0),
      hasActiveOrScheduledHeadquarter: jest.fn(),
      createAndSave: jest.fn().mockImplementation((data) => ({ id: 'loc-1', ...data }) as Location),
    };

    mockCompanyRepo = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-1',
        timezone: 'UTC',
      } as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as CompanySetupStepEntity),
    };

    const mockManager: Partial<EntityManager> = {
      getRepository: jest
        .fn()
        .mockReturnValue(mockOutboxRepo as unknown as Repository<OutboxEventEntity>),
    };

    mockDataSource = {
      manager: mockManager as EntityManager,
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation(async (cb) => cb()),
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

  it('should reject if effectiveAt is in the past or earlier than end of current business day', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    await expect(
      service.create(
        {
          name: 'Tokyo HQ',
          effectiveAt: pastDate,
        },
        mockAuthContext,
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
      mockAuthContext,
    );

    expect(result.code).toBe('LO00001');
    expect(mockLocationRepo.createAndSave).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'LO00001' }),
      mockDataSource.manager,
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
      mockAuthContext,
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
        mockAuthContext,
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
      mockAuthContext,
    );

    expect(result.id).toBe('loc-1');
    expect(result.code).toBe('LO00001');
    expect(result.status).toBe(MasterDataStatus.SCHEDULED);
    expect(mockSetupStepRepo.markStepCompleted).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      companyId: 'comp-1',
      stepType: SetupStepType.LOCATION,
      completedBy: 'user-1',
      entityManager: mockDataSource.manager,
    });
    expect(mockOutboxRepo.save).toHaveBeenCalled();
  });
});
