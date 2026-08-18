import { AuthContext } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PocType } from '../../src/enums';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { CompanySetupStepEntity } from '../../src/modules/company/entities/company-setup-step.entity';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
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
  let mockDataSource: jest.Mocked<DataSource>;
  let mockEntityManager: jest.Mocked<EntityManager>;
  let mockOutboxRepo: jest.Mocked<Repository<OutboxEventEntity>>;

  const authContext: AuthContext = {
    tenantCode: 'tenant-123',
    userId: 'user-admin',
    roles: ['Administrator'],
    sessionId: 'session-123',
    scopes: [],
    permissions: ['poc:create'],
  };

  const sharedEmployeeId = '550e8400-e29b-41d4-a716-446655440000';
  const futureEffectiveDate = new Date(Date.now() + 86400000 * 5).toISOString();

  beforeEach(() => {
    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto: unknown) => dto),
      save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
    } as unknown as jest.Mocked<Repository<OutboxEventEntity>>;

    mockEntityManager = {
      getRepository: jest.fn().mockReturnValue(mockOutboxRepo),
    } as unknown as jest.Mocked<EntityManager>;

    mockDataSource = {
      manager: mockEntityManager,
    } as unknown as jest.Mocked<DataSource>;

    const mockTransactionService = {
      runInTransaction: jest.fn().mockImplementation(async (cb: () => Promise<unknown>) => cb()),
    } as unknown as jest.Mocked<TransactionService>;

    mockPocRepo = {
      findById: jest.fn(),
      findByCompanyAndType: jest.fn(),
      findActiveByCompany: jest.fn(),
      createAndSave: jest.fn().mockImplementation((dto: Partial<PocEntity>) =>
        Promise.resolve({
          id: 'poc-' + Math.random(),
          ...dto,
        } as PocEntity),
      ),
      save: jest.fn(),
    } as unknown as jest.Mocked<PocRepository>;

    mockEmployeeRefRepo = {
      findByEmployeeId: jest.fn().mockResolvedValue({
        id: 'ref-1',
        employeeId: sharedEmployeeId,
        employmentStatus: 'ACTIVE',
      } as EmployeeReferenceEntity),
      findByCompanyAndEmployeeId: jest.fn(),
      findByEmployeeIds: jest.fn(),
    } as unknown as jest.Mocked<EmployeeReferenceRepository>;

    mockCompanyRepo = {
      findByIdAndTenant: jest.fn().mockImplementation((companyId: string, tenantId: string) =>
        Promise.resolve({
          id: companyId,
          tenantId,
          timezone: 'UTC',
        } as CompanyEntity),
      ),
    } as unknown as jest.Mocked<CompanyRepository>;

    mockCompanySetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as unknown as CompanySetupStepEntity),
    } as unknown as jest.Mocked<CompanySetupStepRepository>;

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn(),
      createAndSave: jest.fn(),
    } as unknown as jest.Mocked<EffectiveChangeRepository>;

    service = new PocService(
      mockDataSource,
      mockTransactionService,
      mockPocRepo,
      mockEmployeeRefRepo,
      mockCompanyRepo,
      mockCompanySetupStepRepo,
      mockEffectiveChangeRepo,
    );
  });

  it('should allow the same employee to hold multiple distinct PoC roles within the same company', async () => {
    // 1. Assign as HR_HEAD
    mockPocRepo.findByCompanyAndType.mockResolvedValueOnce(null);
    const hrPoc = await service.create(
      'company-A',
      {
        pocType: PocType.HR_HEAD,
        employeeId: sharedEmployeeId,
        effectiveAt: futureEffectiveDate,
      },
      authContext,
    );

    expect(hrPoc.pocType).toBe(PocType.HR_HEAD);
    expect(hrPoc.employeeId).toBe(sharedEmployeeId);

    // 2. Assign as FINANCE_HEAD in same company
    mockPocRepo.findByCompanyAndType.mockResolvedValueOnce(null);
    const financePoc = await service.create(
      'company-A',
      {
        pocType: PocType.FINANCE_HEAD,
        employeeId: sharedEmployeeId,
        effectiveAt: futureEffectiveDate,
      },
      authContext,
    );

    expect(financePoc.pocType).toBe(PocType.FINANCE_HEAD);
    expect(financePoc.employeeId).toBe(sharedEmployeeId);
  });

  it('should allow the same employee to hold PoC roles across sibling companies', async () => {
    // 1. Assign as COUNTRY_HEAD in Company A
    mockPocRepo.findByCompanyAndType.mockResolvedValueOnce(null);
    const companyAPoc = await service.create(
      'company-A',
      {
        pocType: PocType.COUNTRY_HEAD,
        employeeId: sharedEmployeeId,
        effectiveAt: futureEffectiveDate,
      },
      authContext,
    );

    expect(companyAPoc.companyId).toBe('company-A');

    // 2. Assign as COUNTRY_HEAD in sibling Company B
    mockPocRepo.findByCompanyAndType.mockResolvedValueOnce(null);
    const companyBPoc = await service.create(
      'company-B',
      {
        pocType: PocType.COUNTRY_HEAD,
        employeeId: sharedEmployeeId,
        effectiveAt: futureEffectiveDate,
      },
      authContext,
    );

    expect(companyBPoc.companyId).toBe('company-B');
  });
});
