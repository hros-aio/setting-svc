import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { Location, TransactionService } from '@new-hros/libs-sql';
import { MasterDataStatus } from '../../src/enums';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { OutboxEventRepository } from '../../src/modules/company/repositories/outbox-event.repository';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';
import { LocationRepository } from '../../src/modules/location/repositories/location.repository';
import { LocationService } from '../../src/modules/location/services/location.service';

describe('LocationService - Update Location [US3]', () => {
  let service: LocationService;
  let mockLocationRepo: jest.Mocked<Partial<LocationRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockEffectiveChangeRepo: jest.Mocked<Partial<EffectiveChangeRepository>>;
  let mockOutboxEventRepo: { create: jest.Mock };
  let mockTxService: jest.Mocked<Partial<TransactionService>>;

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-1',
      sessionId: 'sess-1',
      tenantCode: 'tenant-1',
      roles: ['admin'],
      scopes: [],
      permissions: ['location:update'],
    });
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-1' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxEventRepo = {
      create: jest.fn().mockResolvedValue({ id: 'outbox-1' } as unknown as OutboxEventEntity),
    };

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(
          async (entity) => ({ id: 'chg-1', ...entity }) as unknown as EffectiveChangeEntity,
        ),
    };

    mockLocationRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'loc-1',
        name: 'Tokyo HQ',
        tenantCode: 'tenant-1',
        companyId: 'comp-1',
        status: MasterDataStatus.ACTIVE,
        updatedAt: new Date('2026-08-16T00:00:00Z'),
      } as unknown as Location),
      hasActiveOrScheduledHeadquarter: jest.fn().mockResolvedValue(false),
      update: jest.fn().mockImplementation(async (id, entity) => entity as Location),
    };

    mockCompanyRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'comp-1',
        tenantCode: 'tenant-1',
        timezone: 'UTC',
      } as unknown as CompanyEntity),
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation(async (cb) => cb()),
    };

    service = new LocationService(
      mockTxService as unknown as TransactionService,
      mockOutboxEventRepo as unknown as OutboxEventRepository,
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
    } as unknown as Location);

    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    await expect(
      service.scheduleUpdate(
        'loc-1',
        {
          name: 'New Name',
          effectiveAt: futureDate,
        },
        'comp-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject if another pending change already exists (INV-007)', async () => {
    (mockEffectiveChangeRepo.findPendingChange as jest.Mock).mockResolvedValue({
      id: 'existing-pending',
    } as unknown as EffectiveChangeEntity);

    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    await expect(
      service.scheduleUpdate(
        'loc-1',
        {
          name: 'New Name',
          effectiveAt: futureDate,
        },
        'comp-1',
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
      'comp-1',
    );

    expect(result.id).toBe('loc-1');
    expect(result.name).toBe('Updated Name');
    expect(mockLocationRepo.update).toHaveBeenCalled();
    expect(mockEffectiveChangeRepo.create).toHaveBeenCalled();
    expect(mockOutboxEventRepo.create).toHaveBeenCalled();
  });
});
