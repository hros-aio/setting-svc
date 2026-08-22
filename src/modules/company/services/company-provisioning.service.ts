import { BadRequestException, Injectable } from '@nestjs/common';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource } from 'typeorm';
import { TenantRepository } from '../../tenant/repositories/tenant.repository';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { CompanyRepository } from '../repositories/company.repository';
import { SetupStepSeederService } from './setup-step-seeder.service';

import { AggregateType, CompanyEventType, CompanyStatus, OutboxStatus } from '../../../enums';
import { TenantCreatedPayload } from '../../../kafka/types/tenant-lifecycle-events.types';

export interface ProvisioningResult {
  success: boolean;
  reason?: 'ALREADY_EXISTS';
  companyId?: string;
}

@Injectable()
export class CompanyProvisioningService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly dataSource: DataSource,
    private readonly tenantRepository: TenantRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly setupStepSeederService: SetupStepSeederService,
  ) {}

  generateCompanyCode(tenantCode: string): string {
    const sanitized = tenantCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '_');
    return `${sanitized}_HQ`;
  }

  async provisionCompanyOnTenantCreated(
    _eventId: string,
    _topic: string,
    payload: TenantCreatedPayload,
  ): Promise<ProvisioningResult> {
    if (!payload.tenantCode || !payload.name) {
      throw new BadRequestException(
        'tenantCode and name are required in tenant provisioning payload',
      );
    }

    return this.transactionService.runInTransaction(async () => {
      // 1. Upsert Tenant projection record
      const tenantRecord = await this.tenantRepository.upsertTenant({
        tenantId: payload.tenantId,
        tenantCode: payload.tenantCode,
        name: payload.name,
        sourceVersion: payload.sourceVersion ? String(payload.sourceVersion) : '1',
      });

      // 2. Check if default template Company already exists for this tenant
      const existingTemplateCompany = await this.companyRepository.findTemplateCompanyByTenantId(
        tenantRecord.id,
      );

      if (existingTemplateCompany) {
        return { success: true, reason: 'ALREADY_EXISTS', companyId: existingTemplateCompany.id };
      }

      // 3. Auto-generate company code
      const autoCompanyCode = this.generateCompanyCode(payload.tenantCode);

      // 4. Create initial Company in PENDING status with is_template = true
      const newCompany = await this.companyRepository.createAndSave({
        tenantId: tenantRecord.id,
        companyCode: autoCompanyCode,
        legalName: payload.legalName || payload.name,
        displayName: payload.displayName || payload.name,
        status: CompanyStatus.PENDING,
        isTemplate: true,
        countryCode: payload.countryCode || undefined,
        currencyCode: payload.currencyCode || undefined,
        timezone: payload.timezone || 'UTC',
      });

      // 5. Seed the 8 mandatory setup steps
      await this.setupStepSeederService.seedMandatorySteps(tenantRecord.id, newCompany.id);

      // 6. Write Transactional Outbox Event
      const outboxRepo = this.dataSource.getRepository(OutboxEventEntity);
      const outboxEvent = outboxRepo.create({
        aggregateType: AggregateType.COMPANY,
        aggregateId: newCompany.id,
        eventType: CompanyEventType.COMPANY_CREATED,
        payload: {
          companyId: newCompany.id,
          tenantId: tenantRecord.id,
          companyCode: newCompany.companyCode,
          legalName: newCompany.legalName,
          status: newCompany.status,
          isTemplate: newCompany.isTemplate,
        },
        executionTime: new Date(),
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(outboxEvent);

      return {
        success: true,
        companyId: newCompany.id,
      };
    });
  }
}
