import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DepartmentService } from '../../src/modules/department/services/department.service';
import { MasterDataStatus, SetupStepType } from '../../src/enums';
import { DepartmentRepository } from '../../src/modules/department/repositories/department.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { DepartmentEntity } from '../../src/modules/department/entities/department.entity';
import { CompanySetupStepEntity } from '../../src/modules/company/entities/company-setup-step.entity';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';

describe('DepartmentService - Create Department [US1]', () => {
  let service: DepartmentService;
  let mockDepartmentRepo: jest.Mocked<Partial<DepartmentRepository>>;
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
    permissions: ['department:create'],
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
      findByCode: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      createAndSave: jest
        .fn()
        .mockImplementation((data) => ({ id: 'dept-1', ...data }) as DepartmentEntity),
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

    service = new DepartmentService(
      mockDataSource as unknown as DataSource,
      mockTxService as unknown as TransactionService,
      mockDepartmentRepo as unknown as DepartmentRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      {} as unknown as EffectiveChangeRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject if effectiveAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    await expect(
      service.create(
        {
          code: 'ENG',
          name: 'Engineering',
          effectiveAt: pastDate,
        },
        mockAuthContext,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject if department code already exists in company', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockDepartmentRepo.findByCode as jest.Mock).mockResolvedValue({
      id: 'existing-dept',
    } as DepartmentEntity);

    await expect(
      service.create(
        {
          code: 'ENG',
          name: 'Engineering',
          effectiveAt: futureDate,
        },
        mockAuthContext,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject if parent department does not exist', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.create(
        {
          code: 'ENG-BE',
          name: 'Backend Engineering',
          parentDepartmentId: 'non-existent-parent',
          effectiveAt: futureDate,
        },
        mockAuthContext,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject if parent department is not active', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue({
      id: 'parent-dept',
      status: MasterDataStatus.INACTIVE,
    } as DepartmentEntity);

    await expect(
      service.create(
        {
          code: 'ENG-BE',
          name: 'Backend Engineering',
          parentDepartmentId: 'parent-dept',
          effectiveAt: futureDate,
        },
        mockAuthContext,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should successfully create department in scheduled status and complete setup step', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue({
      id: 'parent-dept',
      status: MasterDataStatus.ACTIVE,
    } as DepartmentEntity);

    const result = await service.create(
      {
        code: 'ENG-BE',
        name: 'Backend Engineering',
        parentDepartmentId: 'parent-dept',
        effectiveAt: futureDate,
      },
      mockAuthContext,
    );

    expect(result.id).toBe('dept-1');
    expect(result.code).toBe('ENG-BE');
    expect(result.status).toBe(MasterDataStatus.SCHEDULED);
    expect(mockSetupStepRepo.markStepCompleted).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      companyId: 'comp-1',
      stepType: SetupStepType.DEPARTMENT,
      completedBy: 'user-1',
      entityManager: mockDataSource.manager,
    });
    expect(mockOutboxRepo.save).toHaveBeenCalled();
  });
});
