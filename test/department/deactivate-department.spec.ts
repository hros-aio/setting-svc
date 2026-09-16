import { BadRequestException, ConflictException } from '@nestjs/common';
import { DepartmentService } from '../../src/modules/department/services/department.service';
import {
  AggregateType,
  ChangeOperation,
  EffectiveChangeEventType,
  EffectiveChangeStatus,
  MasterDataStatus,
} from '../../src/enums';
import { DepartmentRepository } from '../../src/modules/department/repositories/department.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { OutboxEventRepository } from '../../src/modules/company/repositories/outbox-event.repository';
import { TransactionService } from '@new-hros/libs-sql';
import { RequestContextService } from '@new-hros/libs-core';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { Department } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';

describe('DepartmentService - Deactivate Department [US4]', () => {
  let service: DepartmentService;
  let mockDepartmentRepo: jest.Mocked<Partial<DepartmentRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockEffectiveChangeRepo: jest.Mocked<Partial<EffectiveChangeRepository>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockOutboxRepo: jest.Mocked<Partial<OutboxEventRepository>>;

  const activeDepartment: Department = {
    id: 'dept-1',
    tenantCode: 'tenant-1',
    version: 1,
    companyId: 'comp-1',
    code: 'ENG',
    name: 'Engineering',
    status: MasterDataStatus.ACTIVE,
    effectiveAt: new Date('2026-01-01'),
    createdAt: new Date(),
    updatedAt: new Date('2026-01-01'),
    children: [],
    company: {} as CompanyEntity,
  };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-1',
      sessionId: 'sess-1',
      tenantCode: 'tenant-1',
      roles: ['admin'],
      scopes: [],
      permissions: ['department:deactivate'],
    });
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-1' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => Promise.resolve(dto as OutboxEventEntity)),
    };

    mockDepartmentRepo = {
      findById: jest.fn().mockResolvedValue(activeDepartment),
    };

    mockCompanyRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'comp-1',
        timezone: 'UTC',
      } as unknown as CompanyEntity),
    };

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) =>
        Promise.resolve({
          id: 'change-1',
          ...dto,
        } as unknown as EffectiveChangeEntity),
      ),
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation(async (cb) => cb()),
    };

    service = new DepartmentService(
      mockTxService as unknown as TransactionService,
      mockDepartmentRepo as unknown as DepartmentRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      {} as unknown as CompanySetupStepRepository,
      mockEffectiveChangeRepo as unknown as EffectiveChangeRepository,
      mockOutboxRepo as unknown as OutboxEventRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject deactivation if department is already inactive', async () => {
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue({
      ...activeDepartment,
      status: MasterDataStatus.INACTIVE,
    });

    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    await expect(
      service.scheduleDeactivation('dept-1', { effectiveAt: futureDate }, 'comp-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject deactivation if pending change already exists (BR-13)', async () => {
    (mockEffectiveChangeRepo.findPendingChange as jest.Mock).mockResolvedValue({
      id: 'existing-change',
      status: EffectiveChangeStatus.SCHEDULED,
    } as unknown as EffectiveChangeEntity);

    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    await expect(
      service.scheduleDeactivation('dept-1', { effectiveAt: futureDate }, 'comp-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('should successfully schedule deactivation without mutating master row', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();

    const result = await service.scheduleDeactivation(
      'dept-1',
      { effectiveAt: futureDate },
      'comp-1',
    );

    expect(result.id).toBe('change-1');
    expect(result.operation).toBe(ChangeOperation.DEACTIVATE);
    expect(result.status).toBe(EffectiveChangeStatus.SCHEDULED);
    expect(mockEffectiveChangeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'department',
        entityId: 'dept-1',
        operation: ChangeOperation.DEACTIVATE,
      }),
    );
    expect(mockOutboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: AggregateType.EFFECTIVE_CHANGE,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      }),
    );
  });
});
