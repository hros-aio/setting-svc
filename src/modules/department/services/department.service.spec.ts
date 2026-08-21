import { ConflictException } from '@nestjs/common';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource } from 'typeorm';
import { CompanyEntity } from '../../company/entities/company.entity';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { Department } from '@new-hros/libs-sql';
import { DepartmentRepository } from '../repositories/department.repository';
import { DepartmentService } from './department.service';

describe('DepartmentService - Multi-Company Isolation & Invariants [US1, US2]', () => {
  let service: DepartmentService;
  let mockDeptRepo: { [K in keyof DepartmentRepository]?: jest.Mock };
  let mockCompanyRepo: { [K in keyof CompanyRepository]?: jest.Mock };
  let mockSetupStepRepo: { [K in keyof CompanySetupStepRepository]?: jest.Mock };
  let mockDataSource: { manager: { getRepository: jest.Mock } };
  let mockTxService: { runInTransaction: jest.Mock };
  let mockOutboxRepo: { create: jest.Mock; save: jest.Mock };

  const mockAuthContextA: AuthContext = {
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
      .mockReturnValue({ companyId: 'comp-A' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => dto as OutboxEventEntity),
      save: jest.fn().mockResolvedValue({ id: 'outbox-1' } as OutboxEventEntity),
    };

    mockDeptRepo = {
      findByCode: jest.fn(),
      findById: jest.fn(),
      createAndSave: jest
        .fn()
        .mockImplementation((data) => ({ id: 'dept-1', ...data }) as Department),
    };

    mockCompanyRepo = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: 'comp-A',
        tenantId: 'tenant-1',
        timezone: 'UTC',
      } as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as never),
    };

    mockDataSource = {
      manager: {
        getRepository: jest.fn().mockReturnValue(mockOutboxRepo),
      },
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new DepartmentService(
      mockDataSource as unknown as DataSource,
      mockTxService as unknown as TransactionService,
      mockDeptRepo as unknown as DepartmentRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      {} as unknown as EffectiveChangeRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should allow creating Department code ENG in Company A', async () => {
    mockDeptRepo.findByCode!.mockResolvedValue(null);

    const result = await service.create(
      {
        code: 'ENG',
        name: 'Engineering',
        effectiveAt: '2099-01-01T00:00:00Z',
      },
      mockAuthContextA,
    );

    expect(result).toBeDefined();
    expect(mockDeptRepo.findByCode).toHaveBeenCalledWith('tenant-1', 'comp-A', 'ENG');
  });

  it('should reject creating duplicate Department code ENG within same Company A', async () => {
    mockDeptRepo.findByCode!.mockResolvedValue({
      id: 'existing-dept',
      code: 'ENG',
      companyId: 'comp-A',
    } as Department);

    await expect(
      service.create(
        {
          code: 'ENG',
          name: 'Duplicate Engineering',
          effectiveAt: '2099-01-01T00:00:00Z',
        },
        mockAuthContextA,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject creating a Department referencing a parentDepartmentId that does not exist in target company [US2]', async () => {
    mockDeptRepo.findByCode!.mockResolvedValue(null);
    mockDeptRepo.findById!.mockResolvedValue(null);

    await expect(
      service.create(
        {
          code: 'BACKEND',
          name: 'Backend Engineering',
          parentDepartmentId: 'dept-in-comp-B',
          effectiveAt: '2099-01-01T00:00:00Z',
        },
        mockAuthContextA,
      ),
    ).rejects.toThrow();
  });
});
