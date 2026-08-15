import { BadRequestException } from '@nestjs/common';
import { CompanyProvisioningService } from './company-provisioning.service';
import { SetupStepSeederService } from './setup-step-seeder.service';
import { TenantRepository } from '../../tenant/repositories/tenant.repository';
import { CompanyRepository } from '../repositories/company.repository';
import { CompanyStatus, KafkaTopic } from '../../../enums';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource, Repository } from 'typeorm';
import { TenantEntity } from '../../tenant/entities/tenant.entity';
import { CompanyEntity } from '../entities/company.entity';
import { OutboxEventEntity } from '../entities/outbox-event.entity';

describe('CompanyProvisioningService', () => {
  let service: CompanyProvisioningService;
  let mockTransactionService: jest.Mocked<Partial<TransactionService>>;
  let mockTenantRepo: jest.Mocked<Partial<TenantRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockSetupStepSeederService: jest.Mocked<Partial<SetupStepSeederService>>;
  let mockDataSource: jest.Mocked<Partial<DataSource>>;
  let mockOutboxRepo: jest.Mocked<Partial<Repository<OutboxEventEntity>>>;

  beforeEach(() => {
    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => dto as OutboxEventEntity),
      save: jest.fn().mockImplementation((dto) => Promise.resolve(dto as OutboxEventEntity)),
    };

    mockDataSource = {
      getRepository: jest
        .fn()
        .mockReturnValue(mockOutboxRepo as unknown as Repository<OutboxEventEntity>),
    };

    mockTransactionService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    mockTenantRepo = {
      upsertTenant: jest.fn().mockResolvedValue({
        id: 't-uuid-1',
        tenantId: 'ext-t-uuid',
        tenantCode: 'ACME',
        name: 'Acme Corp',
        sourceVersion: '1',
      } as TenantEntity),
    };

    mockCompanyRepo = {
      findTemplateCompanyByTenantId: jest.fn().mockResolvedValue(null),
      createAndSave: jest.fn().mockResolvedValue({
        id: 'c-uuid-1',
        tenantId: 't-uuid-1',
        companyCode: 'ACME_HQ',
        legalName: 'Acme Corp Inc',
        status: CompanyStatus.PENDING,
        isTemplate: true,
      } as CompanyEntity),
    };

    mockSetupStepSeederService = {
      seedMandatorySteps: jest.fn().mockResolvedValue([]),
    };

    service = new CompanyProvisioningService(
      mockTransactionService as TransactionService,
      mockDataSource as DataSource,
      mockTenantRepo as unknown as TenantRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepSeederService as unknown as SetupStepSeederService,
    );
  });

  it('should throw BadRequestException if tenantCode or name is missing in payload', async () => {
    await expect(
      service.provisionCompanyOnTenantCreated('evt-1', 'topic', {
        tenantId: '1',
        tenantCode: '',
        name: 'Test',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.provisionCompanyOnTenantCreated('evt-1', 'topic', {
        tenantId: '1',
        tenantCode: 'ACME',
        name: '',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should gracefully handle already existing template company for tenant (idempotency)', async () => {
    mockCompanyRepo.findTemplateCompanyByTenantId = jest
      .fn()
      .mockResolvedValue({ id: 'c-existing' } as CompanyEntity);

    const result = await service.provisionCompanyOnTenantCreated(
      'evt-1',
      KafkaTopic.TENANT_LIFECYCLE_EVENTS,
      {
        tenantId: 'ext-t-1',
        tenantCode: 'ACME',
        name: 'Acme Corp',
      },
    );

    expect(result).toEqual({ success: true, reason: 'ALREADY_EXISTS', companyId: 'c-existing' });
    expect(mockCompanyRepo.createAndSave).not.toHaveBeenCalled();
    expect(mockSetupStepSeederService.seedMandatorySteps).not.toHaveBeenCalled();
  });

  it('should provision tenant projection, template company (PENDING with is_template = true), 8 setup steps and outbox event', async () => {
    const result = await service.provisionCompanyOnTenantCreated(
      'evt-1',
      KafkaTopic.TENANT_LIFECYCLE_EVENTS,
      {
        tenantId: 'ext-t-1',
        tenantCode: 'ACME',
        name: 'Acme Corp',
        legalName: 'Acme Corp Inc',
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'America/New_York',
      },
    );

    expect(result).toEqual({ success: true, companyId: 'c-uuid-1' });
    expect(mockTenantRepo.upsertTenant).toHaveBeenCalled();
    expect(mockCompanyRepo.createAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't-uuid-1',
        companyCode: 'ACME_HQ',
        legalName: 'Acme Corp Inc',
        status: CompanyStatus.PENDING,
        isTemplate: true,
      }),
    );
    expect(mockSetupStepSeederService.seedMandatorySteps).toHaveBeenCalledWith(
      't-uuid-1',
      'c-uuid-1',
    );
    expect(mockOutboxRepo.save).toHaveBeenCalled();
  });
});
