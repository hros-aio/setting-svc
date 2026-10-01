import { BadRequestException } from '@nestjs/common';
import { OutboxEventEntity, TransactionService } from '@new-hros/libs-sql';
import { Repository } from 'typeorm';
import { CompanyStatus, KafkaTopic } from '../../../enums';
import { TenantEntity } from '../../tenant/entities/tenant.entity';
import { TenantRepository } from '../../tenant/repositories/tenant.repository';
import { CompanyEntity } from '../entities/company.entity';
import { CompanyRepository } from '../repositories/company.repository';
import { OutboxEventService } from '../../outbox-events/services/outbox-event.service';
import { CompanyProvisioningService } from './company-provisioning.service';
import { SetupStepSeederService } from './setup-step-seeder.service';

describe('CompanyProvisioningService', () => {
  let service: CompanyProvisioningService;
  let mockTransactionService: jest.Mocked<Partial<TransactionService>>;
  let mockTenantRepo: jest.Mocked<Partial<TenantRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockSetupStepSeederService: jest.Mocked<Partial<SetupStepSeederService>>;
  let mockOutboxEventService: jest.Mocked<Partial<OutboxEventService>>;

  beforeEach(() => {
    mockOutboxEventService = {
      fromCompanyProvisioned: jest
        .fn()
        .mockImplementation((company, tenantId) =>
          Promise.resolve({ id: 'outbox-id' } as unknown as OutboxEventEntity),
        ),
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
      findTemplateCompany: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'c-uuid-1',
        companyCode: 'ACME_HQ',
        legalName: 'Acme Corp Inc',
        status: CompanyStatus.PENDING,
        isTemplate: true,
      } as unknown as CompanyEntity),
    };

    mockSetupStepSeederService = {
      seedMandatorySteps: jest.fn().mockResolvedValue([]),
    };

    service = new CompanyProvisioningService(
      mockTransactionService as TransactionService,
      mockTenantRepo as unknown as TenantRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepSeederService as unknown as SetupStepSeederService,
      mockOutboxEventService as unknown as OutboxEventService,
    );
  });

  it('should throw BadRequestException if tenantCode or name is missing in payload', async () => {
    await expect(
      service.provisionCompanyOnTenantCreated('evt-1', 'topic', {
        id: '1',
        tenantCode: '',
        name: 'Test',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.provisionCompanyOnTenantCreated('evt-1', 'topic', {
        id: '1',
        tenantCode: 'ACME',
        name: '',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should gracefully handle already existing template company for tenant (idempotency)', async () => {
    mockCompanyRepo.findTemplateCompany = jest
      .fn()
      .mockResolvedValue({ id: 'c-existing' } as unknown as CompanyEntity);

    const result = await service.provisionCompanyOnTenantCreated(
      'evt-1',
      KafkaTopic.TENANT_CREATED,
      {
        id: 'ext-t-1',
        tenantCode: 'ACME',
        name: 'Acme Corp',
      },
    );

    expect(result).toEqual({ success: true, reason: 'ALREADY_EXISTS', companyId: 'c-existing' });
    expect(mockCompanyRepo.create).not.toHaveBeenCalled();
    expect(mockSetupStepSeederService.seedMandatorySteps).not.toHaveBeenCalled();
  });

  it('should provision tenant projection, template company (PENDING with is_template = true), 8 setup steps and outbox event', async () => {
    const result = await service.provisionCompanyOnTenantCreated(
      'evt-1',
      KafkaTopic.TENANT_CREATED,
      {
        id: 'ext-t-1',
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
    expect(mockCompanyRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyCode: 'ACME_HQ',
        legalName: 'Acme Corp Inc',
        status: CompanyStatus.PENDING,
        isTemplate: true,
      }),
    );
    expect(mockSetupStepSeederService.seedMandatorySteps).toHaveBeenCalledWith('ACME', 'c-uuid-1');
    expect(mockOutboxEventService.fromCompanyProvisioned).toHaveBeenCalled();
  });
});
