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
import { Department } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';

describe('DepartmentService - Update Department [US3]', () => {
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
    permissions: ['department:update'],
  };

  const activeDepartment: Department = {
    id: 'dept-1',
    tenantCode: 'tenant-1',
    version: 1,
    tenantId: 'tenant-1',
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
      findByCode: jest.fn().mockResolvedValue(null),
      findAncestorChain: jest.fn().mockResolvedValue([]),
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

  it('should reject update if department is not active', async () => {
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue({
      ...activeDepartment,
      status: MasterDataStatus.INACTIVE,
    });

    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    await expect(
      service.scheduleUpdate(
        'dept-1',
        { name: 'New Eng', effectiveAt: futureDate },
        mockAuthContext,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject update if pending change already exists (BR-13)', async () => {
    (mockEffectiveChangeRepo.findPendingChange as jest.Mock).mockResolvedValue({
      id: 'existing-change',
      status: EffectiveChangeStatus.SCHEDULED,
    } as EffectiveChangeEntity);

    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    await expect(
      service.scheduleUpdate(
        'dept-1',
        { name: 'New Eng', effectiveAt: futureDate },
        mockAuthContext,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject self-parenting', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    await expect(
      service.scheduleUpdate(
        'dept-1',
        { parentDepartmentId: 'dept-1', effectiveAt: futureDate },
        mockAuthContext,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject circular hierarchy loop detected via ancestor chain traversal', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    // Setting dept-1's parent to dept-2, but dept-2 has dept-1 in its ancestor chain
    (mockDepartmentRepo.findById as jest.Mock).mockImplementation((tenantId, compId, id) => {
      if (id === 'dept-1') return Promise.resolve(activeDepartment);
      if (id === 'dept-2') return Promise.resolve({ ...activeDepartment, id: 'dept-2' });
      return Promise.resolve(null);
    });
    (mockDepartmentRepo.findAncestorChain as jest.Mock).mockResolvedValue(['dept-2', 'dept-1']);

    await expect(
      service.scheduleUpdate(
        'dept-1',
        { parentDepartmentId: 'dept-2', effectiveAt: futureDate },
        mockAuthContext,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should successfully schedule department update without mutating master row', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockDepartmentRepo.findById as jest.Mock).mockImplementation((tenantId, compId, id) => {
      if (id === 'dept-1') return Promise.resolve(activeDepartment);
      if (id === 'dept-parent') return Promise.resolve({ ...activeDepartment, id: 'dept-parent' });
      return Promise.resolve(null);
    });
    (mockDepartmentRepo.findAncestorChain as jest.Mock).mockResolvedValue([
      'dept-parent',
      'dept-root',
    ]);

    const result = await service.scheduleUpdate(
      'dept-1',
      {
        name: 'Platform Engineering',
        parentDepartmentId: 'dept-parent',
        effectiveAt: futureDate,
      },
      mockAuthContext,
    );

    expect(result.id).toBe('change-1');
    expect(result.operation).toBe(ChangeOperation.UPDATE);
    expect(result.status).toBe(EffectiveChangeStatus.SCHEDULED);
    expect(mockEffectiveChangeRepo.createAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'department',
        entityId: 'dept-1',
        operation: ChangeOperation.UPDATE,
        payload: {
          name: 'Platform Engineering',
          parentDepartmentId: 'dept-parent',
        },
      }),
      mockDataSource.manager,
    );
    expect(mockOutboxRepo.save).toHaveBeenCalled();
  });
});
