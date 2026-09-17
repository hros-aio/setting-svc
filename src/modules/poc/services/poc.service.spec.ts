import { ConflictException, NotFoundException } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { PocType } from '../../../enums';
import { CompanyEntity } from '../../company/entities/company.entity';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { OutboxEventRepository } from '../../company/repositories/outbox-event.repository';
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
  let mockTxService: { runInTransaction: jest.Mock };
  let mockOutboxEventRepo: { [K in keyof OutboxEventRepository]?: jest.Mock };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-1',
      employee: { companyId: 'comp-A' },
    } as unknown as ReturnType<typeof RequestContextService.getUser>);
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-A' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxEventRepo = {
      create: jest.fn().mockImplementation(async (dto) => ({ id: 'outbox-1', ...dto })),
    };

    mockPocRepo = {
      findByCompanyAndType: jest.fn(),
      findById: jest.fn(),
      create: jest.fn().mockImplementation(async (data) => ({ id: 'poc-1', ...data }) as PocEntity),
    };

    mockEmployeeRefRepo = {
      findByEmployeeId: jest.fn(),
    };

    mockCompanyRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'comp-A',
        timezone: 'UTC',
      } as unknown as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as never),
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new PocService(
      mockTxService as unknown as TransactionService,
      mockOutboxEventRepo as unknown as OutboxEventRepository,
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

    const result = await service.create('comp-A', {
      pocType: PocType.HR_HEAD,
      employeeId: 'emp-1',
      effectiveAt: '2099-01-01T00:00:00Z',
    });

    expect(result).toBeDefined();
    expect(mockPocRepo.findByCompanyAndType).toHaveBeenCalledWith('comp-A', PocType.HR_HEAD);
  });

  it('should reject assigning PoC if employee does not exist in the tenant directory [US2]', async () => {
    mockEmployeeRefRepo.findByEmployeeId!.mockResolvedValue(null);

    await expect(
      service.create('comp-A', {
        pocType: PocType.HR_HEAD,
        employeeId: 'emp-foreign',
        effectiveAt: '2099-01-01T00:00:00Z',
      }),
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
      service.create('comp-A', {
        pocType: PocType.HR_HEAD,
        employeeId: 'emp-1',
        effectiveAt: '2099-01-01T00:00:00Z',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
