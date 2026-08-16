import { BadRequestException, ConflictException } from '@nestjs/common';
import { LocationService } from '../../src/modules/location/services/location.service';
import { MasterDataStatus } from '../../src/enums';
import { LocationRepository } from '../../src/modules/location/repositories/location.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { LocationEntity } from '../../src/modules/location/entities/location.entity';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';

describe('LocationService - Update Location [US3]', () => {
  let service: LocationService;
  let mockLocationRepo: jest.Mocked<Partial<LocationRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockEffectiveChangeRepo: jest.Mocked<Partial<EffectiveChangeRepository>>;
  let mockOutboxRepo: jest.Mocked<Partial<Repository<OutboxEventEntity>>>;
  let mockDataSource: jest.Mocked<Partial<DataSource>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    sessionId: 'sess-1',
    tenantCode: 'tenant-1',
    roles: ['admin'],
    scopes: [],
    permissions: ['location:update'],
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

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn(),
      createAndSave: jest
        .fn()
        .mockImplementation(
          async (entity) => ({ id: 'chg-1', ...entity }) as EffectiveChangeEntity,
        ),
    };

    mockLocationRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'loc-1',
        name: 'Tokyo HQ',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        status: MasterDataStatus.ACTIVE,
        updatedAt: new Date('2026-08-16T00:00:00Z'),
      } as LocationEntity),
      hasActiveOrScheduledHeadquarter: jest.fn().mockResolvedValue(false),
      save: jest.fn().mockImplementation(async (entity) => entity as LocationEntity),
    };

    mockCompanyRepo = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-1',
        timezone: 'UTC',
      } as CompanyEntity),
    };

    const mockManager: Partial<EntityManager> = {
      getRepository: jest.fn().mockImplementation((entityClass) => {
        if (entityClass === OutboxEventEntity) return mockOutboxRepo;
        return null;
      }),
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
      {} as unknown as CompanySetupStepRepository,
      mockEffectiveChangeRepo as unknown as EffectiveChangeRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject if location is not active', async () => {
    (mockLocationRepo.findById as jest.Mock).mockResolvedValue({
      id: 'loc-1',
      status: MasterDataStatus.SCHEDULED,
    } as LocationEntity);

    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    await expect(
      service.scheduleUpdate(
        'loc-1',
        {
          name: 'New Name',
          effectiveAt: futureDate,
        },
        mockAuthContext,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject if another pending change already exists (INV-007)', async () => {
    (mockEffectiveChangeRepo.findPendingChange as jest.Mock).mockResolvedValue({
      id: 'existing-pending',
    } as EffectiveChangeEntity);

    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    await expect(
      service.scheduleUpdate(
        'loc-1',
        {
          name: 'New Name',
          effectiveAt: futureDate,
        },
        mockAuthContext,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should schedule update successfully, update location in DB, and write outbox event', async () => {
    (mockEffectiveChangeRepo.findPendingChange as jest.Mock).mockResolvedValue(null);

    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    const result = await service.scheduleUpdate(
      'loc-1',
      {
        name: 'Updated Name',
        effectiveAt: futureDate,
      },
      mockAuthContext,
    );

    expect(result.id).toBe('loc-1');
    expect(result.name).toBe('Updated Name');
    expect(mockLocationRepo.save).toHaveBeenCalled();
    expect(mockEffectiveChangeRepo.createAndSave).toHaveBeenCalled();
    expect(mockOutboxRepo.save).toHaveBeenCalled();
  });
});
