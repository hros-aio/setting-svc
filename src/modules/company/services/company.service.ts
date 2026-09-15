import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import {
  AggregateType,
  CompanyEventType,
  CompanyStatus,
  OutboxStatus,
  SetupStepType,
} from '../../../enums';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyInformationDto } from '../dto/update-company-information.dto';
import { CompanyEntity } from '../entities/company.entity';
import { CopyableCategory } from '../enums/copyable-category.enum';
import { CompanyActivationRejectedException } from '../exceptions/company-activation-rejected.exception';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';
import { CompanyRepository } from '../repositories/company.repository';
import { OutboxEventRepository } from '../repositories/outbox-event.repository';
import { CompanySetupQueryService } from './company-setup-query.service';
import { SetupStepSeederService } from './setup-step-seeder.service';
import { TemplateCopyService } from './template-copy.service';

@Injectable()
export class CompanyService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly companyRepository: CompanyRepository,
    private readonly companySetupStepRepository: CompanySetupStepRepository,
    private readonly setupStepSeederService: SetupStepSeederService,
    private readonly templateCopyService: TemplateCopyService,
    private readonly companySetupQueryService: CompanySetupQueryService,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  async createCompany(dto: CreateCompanyDto): Promise<CompanyEntity> {
    const tenantCode = RequestContextService.getTenantCode();
    const userId = RequestContextService.getUser().userId;
    const codeExists = await this.companyRepository.existsByCode(dto.companyCode);
    if (codeExists) {
      throw new ConflictException(
        `Company with code '${dto.companyCode}' already exists for this tenant`,
      );
    }

    let defaultCompany: CompanyEntity | null = null;
    if (dto.copyFromDefault) {
      defaultCompany = await this.companyRepository.findTemplateCompany();
      if (!defaultCompany) {
        throw new UnprocessableEntityException('No default company configured for template copy');
      }
    }

    return this.transactionService.runInTransaction(async () => {
      // 1. Persist Company
      const newCompany = await this.companyRepository.create({
        tenantCode,
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
          tenantCode,
          defaultCompany.id,
          newCompany.id,
          copiedCategories,
        );
      }

      // 3. Seed setup steps
      const setupSteps = await this.setupStepSeederService.seedMandatorySteps(
        tenantCode,
        newCompany.id,
        dto.copyFromDefault ? copiedCategories : [],
      );
      newCompany.setupSteps = setupSteps;

      // 4. Outbox event for company.created
      await this.outboxEventRepository.create({
        aggregateType: AggregateType.COMPANY,
        aggregateId: newCompany.id,
        eventType: CompanyEventType.COMPANY_CREATED,
        payload: {
          companyId: newCompany.id,
          tenantCode,
          companyCode: newCompany.companyCode,
          companyName: newCompany.displayName || newCompany.legalName,
          status: newCompany.status,
          createdAt: newCompany.createdAt || new Date(),
        },
        executionTime: new Date(),
        status: OutboxStatus.PENDING,
      });

      // 5. Outbox event for role copy delegation if ROLES is selected
      if (
        dto.copyFromDefault &&
        defaultCompany &&
        copiedCategories.includes(CopyableCategory.ROLES)
      ) {
        await this.outboxEventRepository.create({
          aggregateType: AggregateType.COMPANY,
          aggregateId: newCompany.id,
          eventType: CompanyEventType.ROLE_COPY_REQUESTED,
          payload: {
            tenantCode,
            sourceCompanyId: defaultCompany.id,
            targetCompanyId: newCompany.id,
          },
          executionTime: new Date(),
          status: OutboxStatus.PENDING,
        });
      }

      return newCompany;
    });
  }

  async updateCompanyInformation(
    id: string,
    dto: UpdateCompanyInformationDto,
  ): Promise<CompanyEntity> {
    const tenantCode = RequestContextService.getTenantCode();
    const userId = RequestContextService.getUser().userId;

    const company = await this.companyRepository.findById(id, { required: true });
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

      await this.companyRepository.update(id, updateData);

      // Step 1: Mark COMPANY_INFORMATION completed
      await this.companySetupStepRepository.markStepCompleted({
        companyId: id,
        stepType: SetupStepType.COMPANY_INFORMATION,
        completedBy: userId,
      });

      // Outbox event for company.updated
      await this.outboxEventRepository.create({
        aggregateType: AggregateType.COMPANY,
        aggregateId: id,
        eventType: CompanyEventType.COMPANY_UPDATED,
        payload: {
          companyId: id,
          tenantCode,
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
        executionTime: new Date(),
        status: OutboxStatus.PENDING,
      });

      const updatedCompany = await this.companyRepository.findById(id);
      return updatedCompany!;
    });
  }

  async designateDefaultCompany(companyId: string): Promise<CompanyEntity> {
    const userId = RequestContextService.getUser()?.userId;

    const company = await this.companyRepository.findById(companyId, { required: true });
    if (company.isTemplate) {
      return company;
    }

    return this.transactionService.runInTransaction(async () => {
      // 1. Clear existing template for this tenant
      await this.companyRepository.clearTemplateDesignation();

      // 2. Set new template designation
      const updated = await this.companyRepository.setTemplateDesignation(companyId, true, userId);

      return updated;
    });
  }

  async activateCompany(id: string): Promise<CompanyEntity> {
    const tenantCode = RequestContextService.getTenantCode();
    const userId = RequestContextService.getUser().userId;

    const company = await this.companyRepository.findById(id, { required: true });
    if (company.status === CompanyStatus.ACTIVE) {
      throw new UnprocessableEntityException(
        'Company is already in ACTIVE status and cannot be re-activated',
      );
    }

    if (company.status !== CompanyStatus.PENDING) {
      throw new UnprocessableEntityException('Only companies in PENDING status can be activated');
    }

    const validationResult = await this.companySetupQueryService.validateAllStepsCompleted(id);

    if (!validationResult.isEligible) {
      throw new CompanyActivationRejectedException(validationResult.incompleteSteps);
    }

    return this.transactionService.runInTransaction(async () => {
      const now = new Date();
      await this.companyRepository.update(id, {
        status: CompanyStatus.ACTIVE,
        activatedAt: now,
        activatedBy: userId,
        updatedBy: userId,
      });

      // Write domain outbox event for company.activated
      await this.outboxEventRepository.create({
        aggregateType: AggregateType.COMPANY,
        aggregateId: id,
        eventType: CompanyEventType.COMPANY_ACTIVATED,
        payload: {
          companyId: id,
          tenantCode,
          companyCode: company.companyCode,
          displayName: company.displayName,
          legalName: company.legalName,
          status: CompanyStatus.ACTIVE,
          activatedAt: now,
          activatedBy: userId,
          completedStepsCount: validationResult.totalSteps,
        },
        executionTime: new Date(),
        status: OutboxStatus.PENDING,
      });

      const updatedCompany = await this.companyRepository.findById(id);
      return updatedCompany!;
    });
  }
}
