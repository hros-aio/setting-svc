import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { CompanyService } from './company.service';
import { CompanyRepository } from '../repositories/company.repository';
import { SetupStepSeederService } from './setup-step-seeder.service';
import { TemplateCopyService } from './template-copy.service';
import { CompanyEntity } from '../entities/company.entity';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { CompanyStatus, SetupStepStatus, SetupStepType } from '../../../enums';
import { CopyableCategory } from '../enums/copyable-category.enum';

describe('CompanyService', () => {
  let service: CompanyService;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockSeederService: jest.Mocked<Partial<SetupStepSeederService>>;
  let mockCopyService: jest.Mocked<Partial<TemplateCopyService>>;
  let mockTransactionService: jest.Mocked<Partial<TransactionService>>;
  let mockOutboxRepo: jest.Mocked<Partial<Repository<OutboxEventEntity>>>;
  let mockDataSource: jest.Mocked<Partial<DataSource>>;

  beforeEach(() => {
    mockCompanyRepo = {
      existsByTenantAndCode: jest.fn().mockResolvedValue(false),
      findTemplateCompanyByTenantId: jest.fn(),
      createAndSave: jest.fn().mockImplementation((data) =>
        Promise.resolve({
          id: 'new-company-id',
          createdAt: new Date(),
          ...data,
        } as CompanyEntity),
      ),
    };

    const mockStep: Partial<CompanySetupStepEntity> = {
      stepType: SetupStepType.COMPANY_INFORMATION,
      stepOrder: 1,
      status: SetupStepStatus.INCOMPLETE,
    };

    mockSeederService = {
      seedMandatorySteps: jest.fn().mockResolvedValue([mockStep as CompanySetupStepEntity]),
    };

    mockCopyService = {
      copyLocalMasterData: jest.fn().mockResolvedValue({
        copiedGradesCount: 1,
        copiedJobTitlesCount: 1,
      }),
    };

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((data) => ({ id: 'outbox-id', ...data })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockOutboxRepo),
      manager: {} as EntityManager,
    };

    mockTransactionService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new CompanyService(
      mockDataSource as unknown as DataSource,
      mockTransactionService as unknown as TransactionService,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSeederService as unknown as SetupStepSeederService,
      mockCopyService as unknown as TemplateCopyService,
    );
  });

  it('should create a company with PENDING status and write company.created outbox event', async () => {
    const tenantId = 'tenant-1';
    const dto = {
      companyCode: 'NEW_CO',
      name: 'New Company',
      countryCode: 'US',
      currencyCode: 'USD',
      timezone: 'UTC',
      copyFromDefault: false,
    };

    const result = await service.createCompany(tenantId, dto);

    expect(result.status).toBe(CompanyStatus.PENDING);
    expect(result.isTemplate).toBe(false);
    expect(mockOutboxRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw ConflictException if company code already exists for tenant', async () => {
    (mockCompanyRepo.existsByTenantAndCode as jest.Mock).mockResolvedValue(true);

    await expect(
      service.createCompany('tenant-1', {
        companyCode: 'EXISTING',
        name: 'Existing',
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'UTC',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw UnprocessableEntityException if copyFromDefault is true but no template company exists', async () => {
    (mockCompanyRepo.findTemplateCompanyByTenantId as jest.Mock).mockResolvedValue(null);

    await expect(
      service.createCompany('tenant-1', {
        companyCode: 'NEW_CO',
        name: 'New Company',
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'UTC',
        copyFromDefault: true,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('should write role-copy.requested outbox event when ROLES is selected in copyCategories', async () => {
    (mockCompanyRepo.findTemplateCompanyByTenantId as jest.Mock).mockResolvedValue({
      id: 'default-co-id',
      tenantId: 'tenant-1',
      isTemplate: true,
    } as CompanyEntity);

    const result = await service.createCompany('tenant-1', {
      companyCode: 'NEW_CO',
      name: 'New Company',
      countryCode: 'US',
      currencyCode: 'USD',
      timezone: 'UTC',
      copyFromDefault: true,
      copyCategories: [CopyableCategory.ROLES],
    });

    expect(result).toBeDefined();
    expect(mockOutboxRepo.save).toHaveBeenCalledTimes(2);
  });
});
