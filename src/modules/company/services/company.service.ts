import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthContext } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource } from 'typeorm';
import {
  AggregateType,
  CompanyEventType,
  CompanyStatus,
  OutboxStatus,
  SetupStepType,
} from '../../../enums';
import { TenantRepository } from '../../tenant/repositories/tenant.repository';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyInformationDto } from '../dto/update-company-information.dto';
import { CompanyEntity } from '../entities/company.entity';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { CopyableCategory } from '../enums/copyable-category.enum';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';
import { CompanyRepository } from '../repositories/company.repository';
import { SetupStepSeederService } from './setup-step-seeder.service';
import { TemplateCopyService } from './template-copy.service';

@Injectable()
export class CompanyService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionService: TransactionService,
    private readonly companyRepository: CompanyRepository,
    private readonly companySetupStepRepository: CompanySetupStepRepository,
    private readonly tenantRepository: TenantRepository,
    private readonly setupStepSeederService: SetupStepSeederService,
    private readonly templateCopyService: TemplateCopyService,
  ) {}

  private async resolveTenantId(tenantCodeOrId: string): Promise<string> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tenantCodeOrId,
    );
    if (isUuid) {
      return tenantCodeOrId;
    }
    const tenant = await this.tenantRepository.findByTenantCode(tenantCodeOrId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found for tenantCode: ${tenantCodeOrId}`);
    }
    return tenant.id;
  }

  async createCompany(
    tenantCodeOrId: string,
    dto: CreateCompanyDto,
    userId?: string,
  ): Promise<CompanyEntity> {
    const tenantId = await this.resolveTenantId(tenantCodeOrId);

    const codeExists = await this.companyRepository.existsByTenantAndCode(
      tenantId,
      dto.companyCode,
    );
    if (codeExists) {
      throw new ConflictException(
        `Company with code '${dto.companyCode}' already exists for this tenant`,
      );
    }

    let defaultCompany: CompanyEntity | null = null;
    if (dto.copyFromDefault) {
      defaultCompany = await this.companyRepository.findTemplateCompanyByTenantId(tenantId);
      if (!defaultCompany) {
        throw new UnprocessableEntityException('No default company configured for template copy');
      }
    }

    return this.transactionService.runInTransaction(async () => {
      // 1. Persist Company
      const newCompany = await this.companyRepository.createAndSave({
        tenantId,
        companyCode: dto.companyCode,
        legalName: dto.legalName || dto.name,
        displayName: dto.displayName || dto.name,
        registrationNumber: dto.registrationNumber,
        taxRegistrationNumber: dto.taxRegistrationNumber,
        countryCode: dto.countryCode,
        currencyCode: dto.currencyCode,
        timezone: dto.timezone,
        locale: dto.locale,
        status: CompanyStatus.PENDING,
        isTemplate: false,
        createdBy: userId,
      });

      // 2. Perform point-in-time snapshot copy if enabled
      const copiedCategories = dto.copyCategories || [];
      if (dto.copyFromDefault && defaultCompany && copiedCategories.length > 0) {
        await this.templateCopyService.copyLocalMasterData(
          this.dataSource.manager,
          tenantId,
          defaultCompany.id,
          newCompany.id,
          copiedCategories,
        );
      }

      // 3. Seed setup steps
      const setupSteps = await this.setupStepSeederService.seedMandatorySteps(
        tenantId,
        newCompany.id,
        dto.copyFromDefault ? copiedCategories : [],
      );
      newCompany.setupSteps = setupSteps;

      // 4. Outbox event for company.created
      const outboxRepo = this.dataSource.getRepository(OutboxEventEntity);
      const companyCreatedEvent = outboxRepo.create({
        aggregateType: AggregateType.COMPANY,
        aggregateId: newCompany.id,
        eventType: CompanyEventType.COMPANY_CREATED,
        payload: {
          companyId: newCompany.id,
          tenantId,
          companyCode: newCompany.companyCode,
          companyName: newCompany.displayName || newCompany.legalName,
          status: newCompany.status,
          createdAt: newCompany.createdAt || new Date(),
        },
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(companyCreatedEvent);

      // 5. Outbox event for role copy delegation if ROLES is selected
      if (
        dto.copyFromDefault &&
        defaultCompany &&
        copiedCategories.includes(CopyableCategory.ROLES)
      ) {
        const roleCopyEvent = outboxRepo.create({
          aggregateType: AggregateType.COMPANY,
          aggregateId: newCompany.id,
          eventType: CompanyEventType.ROLE_COPY_REQUESTED,
          payload: {
            tenantId,
            sourceCompanyId: defaultCompany.id,
            targetCompanyId: newCompany.id,
          },
          status: OutboxStatus.PENDING,
        });
        await outboxRepo.save(roleCopyEvent);
      }

      return newCompany;
    });
  }

  async updateCompanyInformation(
    tenantCodeOrId: string,
    companyId: string,
    dto: UpdateCompanyInformationDto,
    authContext?: AuthContext | null,
  ): Promise<CompanyEntity> {
    const tenantId = await this.resolveTenantId(tenantCodeOrId);
    const userId = authContext?.userId;

    const company = await this.companyRepository.findByIdAndTenant(companyId, tenantId);
    if (!company) {
      throw new NotFoundException(`Company with ID '${companyId}' not found for this tenant`);
    }

    if (company.status !== CompanyStatus.PENDING && company.status !== CompanyStatus.ACTIVE) {
      throw new UnprocessableEntityException('Company is not in an active or pending status');
    }

    return this.transactionService.runInTransaction(async () => {
      const updateData: Partial<CompanyEntity> = {
        updatedBy: userId,
      };

      if (dto.name !== undefined) {
        updateData.displayName = dto.name;
        if (!dto.legalName && !company.legalName) {
          updateData.legalName = dto.name;
        }
      }
      if (dto.legalName !== undefined) updateData.legalName = dto.legalName;
      if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
      if (dto.registrationNumber !== undefined)
        updateData.registrationNumber = dto.registrationNumber;
      if (dto.taxRegistrationNumber !== undefined)
        updateData.taxRegistrationNumber = dto.taxRegistrationNumber;
      if (dto.countryCode !== undefined) updateData.countryCode = dto.countryCode;
      if (dto.currencyCode !== undefined) updateData.currencyCode = dto.currencyCode;
      if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
      if (dto.locale !== undefined) updateData.locale = dto.locale;
      if (dto.legalAddress !== undefined) updateData.legalAddress = dto.legalAddress;

      const now = new Date();
      if (!company.informationCompletedAt) {
        updateData.informationCompletedAt = now;
        updateData.informationCompletedBy = userId;
      }

      await this.companyRepository.updateCompanyInfo(
        companyId,
        tenantId,
        updateData,
        this.dataSource.manager,
      );

      // Step 1: Mark COMPANY_INFORMATION completed
      await this.companySetupStepRepository.markStepCompleted(
        tenantId,
        companyId,
        SetupStepType.COMPANY_INFORMATION,
        userId,
        this.dataSource.manager,
      );

      // Outbox event for company.updated
      const outboxRepo = this.dataSource.getRepository(OutboxEventEntity);
      const updateEvent = outboxRepo.create({
        aggregateType: AggregateType.COMPANY,
        aggregateId: companyId,
        eventType: CompanyEventType.COMPANY_UPDATED,
        payload: {
          companyId,
          tenantId,
          companyCode: company.companyCode,
          legalName: updateData.legalName || company.legalName,
          displayName: updateData.displayName || company.displayName,
          status: company.status,
          countryCode: updateData.countryCode || company.countryCode,
          currencyCode: updateData.currencyCode || company.currencyCode,
          timezone: updateData.timezone || company.timezone,
          informationCompleted: true,
          informationCompletedAt: company.informationCompletedAt || now,
          informationCompletedBy: company.informationCompletedBy || userId,
          updatedAt: now,
        },
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(updateEvent);

      const updatedCompany = await this.companyRepository.findByIdAndTenant(
        companyId,
        tenantId,
        this.dataSource.manager,
      );
      return updatedCompany!;
    });
  }
}
