import { BadRequestException, ConflictException } from '@nestjs/common';
import { DepartmentService } from '../../src/modules/department/services/department.service';
import { ChangeOperation, EffectiveChangeStatus, MasterDataStatus } from '../../src/enums';
import { DepartmentRepository } from '../../src/modules/department/repositories/department.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { DepartmentEntity } from '../../src/modules/department/entities/department.entity';
import { TenantEntity } from '../../src/modules/tenant/entities/tenant.entity';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';

describe('DepartmentService - Deactivate Department [US4]', () => {
  let service: DepartmentService;
  let mockDepartmentRepo: jest.Mocked<Partial<DepartmentRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockEffectiveChangeRepo: jest.Mocked<Partial<EffectiveChangeRepository>>;
  let mockDataSource: jest.Mocked<Partial<DataSource>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockOutboxRepo: jest.Mocked<Partial<Repository<OutboxEventEntity>>>;

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    sessionId: 'sess-1',
    tenantCode: 'tenant-1',
    roles: ['admin'],
    scopes: [],
    permissions: ['department:deactivate'],
  };

  const activeDepartment: DepartmentEntity = {
    id: 'dept-1',
    tenantId: 'tenant-1',
    companyId: 'comp-1',
    code: 'ENG',
    name: 'Engineering',
    status: MasterDataStatus.ACTIVE,
    effectiveAt: new Date('2026-01-01'),
    createdAt: new Date(),
    updatedAt: new Date('2026-01-01'),
    children: [],
    tenant: {} as TenantEntity,
    company: {} as CompanyEntity,
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

    mockDepartmentRepo = {
      findById: jest.fn().mockResolvedValue(activeDepartment),
    };

    mockCompanyRepo = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-1',
        timezone: 'UTC',
      } as CompanyEntity),
    };

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn().mockResolvedValue(null),
      createAndSave: jest.fn().mockImplementation(
        (dto) =>
          ({
            id: 'change-1',
            ...dto,
          }) as EffectiveChangeEntity,
      ),
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

    service = new DepartmentService(
      mockDataSource as unknown as DataSource,
      mockTxService as unknown as TransactionService,
      mockDepartmentRepo as unknown as DepartmentRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      {} as unknown as CompanySetupStepRepository,
      mockEffectiveChangeRepo as unknown as EffectiveChangeRepository,
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
      service.scheduleDeactivation('dept-1', { effectiveAt: futureDate }, mockAuthContext),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject deactivation if pending change already exists (BR-13)', async () => {
    (mockEffectiveChangeRepo.findPendingChange as jest.Mock).mockResolvedValue({
      id: 'existing-change',
      status: EffectiveChangeStatus.SCHEDULED,
    } as EffectiveChangeEntity);

    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    await expect(
      service.scheduleDeactivation('dept-1', { effectiveAt: futureDate }, mockAuthContext),
    ).rejects.toThrow(ConflictException);
  });

  it('should successfully schedule deactivation without mutating master row', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();

    const result = await service.scheduleDeactivation(
      'dept-1',
      { effectiveAt: futureDate },
      mockAuthContext,
    );

    expect(result.id).toBe('change-1');
    expect(result.operation).toBe(ChangeOperation.DEACTIVATE);
    expect(result.status).toBe(EffectiveChangeStatus.SCHEDULED);
    expect(mockEffectiveChangeRepo.createAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'department',
        entityId: 'dept-1',
        operation: ChangeOperation.DEACTIVATE,
      }),
      mockDataSource.manager,
    );
    expect(mockOutboxRepo.save).toHaveBeenCalled();
  });
});
