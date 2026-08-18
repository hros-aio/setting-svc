import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource } from 'typeorm';
import { PocType } from '../../../enums';
import { CompanyEntity } from '../../company/entities/company.entity';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { EmployeeReferenceEntity } from '../../employee-reference/entities/employee-reference.entity';
import { EmployeeReferenceRepository } from '../../employee-reference/repositories/employee-reference.repository';
import { PocEntity } from '../entities/poc.entity';
import { PocRepository } from '../repositories/poc.repository';
import { PocService } from './poc.service';

describe('PocService - Multi-Company Isolation & Invariants [US1, US2]', () => {
  let service: PocService;
  let mockPocRepo: { [K in keyof PocRepository]?: jest.Mock };
  let mockEmployeeRefRepo: { [K in keyof EmployeeReferenceRepository]?: jest.Mock };
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
    permissions: ['poc:create'],
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

    mockPocRepo = {
      findByCompanyAndType: jest.fn(),
      findById: jest.fn(),
      createAndSave: jest
        .fn()
        .mockImplementation((data) => ({ id: 'poc-1', ...data }) as PocEntity),
    };

    mockEmployeeRefRepo = {
      findByEmployeeId: jest.fn(),
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

    service = new PocService(
      mockDataSource as unknown as DataSource,
      mockTxService as unknown as TransactionService,
      mockPocRepo as unknown as PocRepository,
      mockEmployeeRefRepo as unknown as EmployeeReferenceRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      {} as unknown as EffectiveChangeRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should allow assigning PoC in Company A for HR_HEAD when employee is valid [US1]', async () => {
    mockEmployeeRefRepo.findByEmployeeId!.mockResolvedValue({
      id: 'emp-ref-1',
      employeeId: 'emp-1',
      tenantId: 'tenant-1',
      employmentStatus: 'ACTIVE',
    } as EmployeeReferenceEntity);
    mockPocRepo.findByCompanyAndType!.mockResolvedValue(null);

    const result = await service.create(
      'comp-A',
      {
        pocType: PocType.HR_HEAD,
        employeeId: 'emp-1',
        effectiveAt: '2099-01-01T00:00:00Z',
      },
      mockAuthContextA,
    );

    expect(result).toBeDefined();
    expect(mockPocRepo.findByCompanyAndType).toHaveBeenCalledWith(
      'tenant-1',
      'comp-A',
      PocType.HR_HEAD,
    );
  });

  it('should reject assigning PoC if employee does not exist in the tenant directory [US2]', async () => {
    mockEmployeeRefRepo.findByEmployeeId!.mockResolvedValue(null);

    await expect(
      service.create(
        'comp-A',
        {
          pocType: PocType.HR_HEAD,
          employeeId: 'emp-foreign',
          effectiveAt: '2099-01-01T00:00:00Z',
        },
        mockAuthContextA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject assigning duplicate active PoC for same responsibility type in the same Company A', async () => {
    mockEmployeeRefRepo.findByEmployeeId!.mockResolvedValue({
      id: 'emp-ref-1',
      employeeId: 'emp-1',
      tenantId: 'tenant-1',
      employmentStatus: 'ACTIVE',
    } as EmployeeReferenceEntity);
    mockPocRepo.findByCompanyAndType!.mockResolvedValue({
      id: 'existing-poc',
      pocType: PocType.HR_HEAD,
      companyId: 'comp-A',
    } as PocEntity);

    await expect(
      service.create(
        'comp-A',
        {
          pocType: PocType.HR_HEAD,
          employeeId: 'emp-1',
          effectiveAt: '2099-01-01T00:00:00Z',
        },
        mockAuthContextA,
      ),
    ).rejects.toThrow(ConflictException);
  });
});
