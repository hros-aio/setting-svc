import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DepartmentService } from '../../src/modules/department/services/department.service';
import {
  AggregateType,
  EffectiveChangeEventType,
  MasterDataStatus,
  SetupStepType,
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
import { CompanySetupStepEntity } from '../../src/modules/company/entities/company-setup-step.entity';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';

describe('DepartmentService - Create Department [US1]', () => {
  let service: DepartmentService;
  let mockDepartmentRepo: jest.Mocked<Partial<DepartmentRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockSetupStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockOutboxRepo: jest.Mocked<Partial<OutboxEventRepository>>;

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-1',
      sessionId: 'sess-1',
      tenantCode: 'tenant-1',
      roles: ['admin'],
      scopes: [],
      permissions: ['department:create'],
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
      findByCode: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(async (data) => ({ id: 'dept-1', ...data }) as Department),
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

    service = new DepartmentService(
      mockTxService as unknown as TransactionService,
      mockDepartmentRepo as unknown as DepartmentRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      {} as unknown as EffectiveChangeRepository,
      mockOutboxRepo as unknown as OutboxEventRepository,
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
        'comp-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject if department code already exists in company', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockDepartmentRepo.findByCode as jest.Mock).mockResolvedValue({
      id: 'existing-dept',
    } as Department);

    await expect(
      service.create(
        {
          code: 'ENG',
          name: 'Engineering',
          effectiveAt: futureDate,
        },
        'comp-1',
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
        'comp-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject if parent department is not active', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue({
      id: 'parent-dept',
      status: MasterDataStatus.INACTIVE,
    } as Department);

    await expect(
      service.create(
        {
          code: 'ENG-BE',
          name: 'Backend Engineering',
          parentDepartmentId: 'parent-dept',
          effectiveAt: futureDate,
        },
        'comp-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should successfully create department in scheduled status and complete setup step', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue({
      id: 'parent-dept',
      status: MasterDataStatus.ACTIVE,
    } as Department);

    const result = await service.create(
      {
        code: 'ENG-BE',
        name: 'Backend Engineering',
        parentDepartmentId: 'parent-dept',
        effectiveAt: futureDate,
      },
      'comp-1',
    );

    expect(result.id).toBe('dept-1');
    expect(result.code).toBe('ENG-BE');
    expect(result.status).toBe(MasterDataStatus.SCHEDULED);
    expect(mockSetupStepRepo.markStepCompleted).toHaveBeenCalledWith({
      companyId: 'comp-1',
      stepType: SetupStepType.DEPARTMENT,
      completedBy: 'user-1',
    });
    expect(mockOutboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: AggregateType.DEPARTMENT,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      }),
    );
  });
});
