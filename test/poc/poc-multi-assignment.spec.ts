import { RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { PocType } from '../../src/enums';
import { CompanySetupStepEntity } from '../../src/modules/company/entities/company-setup-step.entity';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { OutboxEventRepository } from '../../src/modules/company/repositories/outbox-event.repository';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';
import { EmployeeReferenceEntity } from '../../src/modules/employee-reference/entities/employee-reference.entity';
import { EmployeeReferenceRepository } from '../../src/modules/employee-reference/repositories/employee-reference.repository';
import { PocEntity } from '../../src/modules/poc/entities/poc.entity';
import { PocRepository } from '../../src/modules/poc/repositories/poc.repository';
import { PocService } from '../../src/modules/poc/services/poc.service';

describe('PoC Multi-Assignment and Sibling Company (US4)', () => {
  let service: PocService;
  let mockPocRepo: jest.Mocked<PocRepository>;
  let mockEmployeeRefRepo: jest.Mocked<EmployeeReferenceRepository>;
  let mockCompanyRepo: jest.Mocked<CompanyRepository>;
  let mockCompanySetupStepRepo: jest.Mocked<CompanySetupStepRepository>;
  let mockEffectiveChangeRepo: jest.Mocked<EffectiveChangeRepository>;
  let mockOutboxRepo: jest.Mocked<OutboxEventRepository>;

  const sharedEmployeeId = '550e8400-e29b-41d4-a716-446655440000';
  const futureEffectiveDate = new Date(Date.now() + 86400000 * 5).toISOString();

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-123');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-admin',
      employee: { companyId: 'company-A' },
    } as unknown as ReturnType<typeof RequestContextService.getUser>);
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'company-A' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation(async (dto) => ({ id: 'outbox-1', ...dto })),
    } as unknown as jest.Mocked<OutboxEventRepository>;

    const mockTransactionService = {
      runInTransaction: jest.fn().mockImplementation(async (cb: () => Promise<unknown>) => cb()),
    } as unknown as jest.Mocked<TransactionService>;

    mockPocRepo = {
      findById: jest.fn(),
      findByCompanyAndType: jest.fn(),
      findActiveByCompany: jest.fn(),
      create: jest.fn().mockImplementation((dto: Partial<PocEntity>) =>
        Promise.resolve({
          id: 'poc-' + Math.random(),
          ...dto,
        } as PocEntity),
      ),
      save: jest.fn(),
    } as unknown as jest.Mocked<PocRepository>;

    mockEmployeeRefRepo = {
      findById: jest.fn().mockResolvedValue({
        id: sharedEmployeeId,
        employeeCode: sharedEmployeeId,
        employmentStatus: 'ACTIVE',
      } as unknown as EmployeeReferenceEntity),
      findByCompanyAndEmployeeId: jest.fn(),
      findByIds: jest.fn(),
    } as unknown as jest.Mocked<EmployeeReferenceRepository>;

    mockCompanyRepo = {
      findById: jest.fn().mockImplementation((companyId: string) =>
        Promise.resolve({
          id: companyId,
          tenantCode: 'tenant-123',
          timezone: 'UTC',
        } as unknown as CompanyEntity),
      ),
    } as unknown as jest.Mocked<CompanyRepository>;

    mockCompanySetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as unknown as CompanySetupStepEntity),
    } as unknown as jest.Mocked<CompanySetupStepRepository>;

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<EffectiveChangeRepository>;

    service = new PocService(
      mockTransactionService,
      mockOutboxRepo,
      mockPocRepo,
      mockEmployeeRefRepo,
      mockCompanyRepo,
      mockCompanySetupStepRepo,
      mockEffectiveChangeRepo,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should allow the same employee to hold multiple distinct PoC roles within the same company', async () => {
    // 1. Assign as HR_HEAD
    mockPocRepo.findByCompanyAndType.mockResolvedValueOnce(null);
    const hrPoc = await service.create('company-A', {
      pocType: PocType.HR_HEAD,
      employeeId: sharedEmployeeId,
      effectiveAt: futureEffectiveDate,
    });

    expect(hrPoc.pocType).toBe(PocType.HR_HEAD);
    expect(hrPoc.employeeId).toBe(sharedEmployeeId);

    // 2. Assign as FINANCE_HEAD in same company
    mockPocRepo.findByCompanyAndType.mockResolvedValueOnce(null);
    const financePoc = await service.create('company-A', {
      pocType: PocType.FINANCE_HEAD,
      employeeId: sharedEmployeeId,
      effectiveAt: futureEffectiveDate,
    });

    expect(financePoc.pocType).toBe(PocType.FINANCE_HEAD);
    expect(financePoc.employeeId).toBe(sharedEmployeeId);
  });

  it('should allow the same employee to hold PoC roles across sibling companies', async () => {
    // 1. Assign as COUNTRY_HEAD in Company A
    mockPocRepo.findByCompanyAndType.mockResolvedValueOnce(null);
    const companyAPoc = await service.create('company-A', {
      pocType: PocType.COUNTRY_HEAD,
      employeeId: sharedEmployeeId,
      effectiveAt: futureEffectiveDate,
    });

    expect(companyAPoc.companyId).toBe('company-A');

    // 2. Assign as COUNTRY_HEAD in sibling Company B
    mockPocRepo.findByCompanyAndType.mockResolvedValueOnce(null);
    const companyBPoc = await service.create('company-B', {
      pocType: PocType.COUNTRY_HEAD,
      employeeId: sharedEmployeeId,
      effectiveAt: futureEffectiveDate,
    });

    expect(companyBPoc.companyId).toBe('company-B');
  });
});
