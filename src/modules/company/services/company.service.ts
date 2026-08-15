import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { CompanyRepository } from '../repositories/company.repository';
import { SetupStepSeederService } from './setup-step-seeder.service';
import { TemplateCopyService } from './template-copy.service';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { CompanyEntity } from '../entities/company.entity';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { AggregateType, CompanyEventType, CompanyStatus, OutboxStatus } from '../../../enums';
import { CopyableCategory } from '../enums/copyable-category.enum';

@Injectable()
export class CompanyService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionService: TransactionService,
    private readonly companyRepository: CompanyRepository,
    private readonly setupStepSeederService: SetupStepSeederService,
    private readonly templateCopyService: TemplateCopyService,
  ) {}

  async createCompany(
    tenantId: string,
    dto: CreateCompanyDto,
    userId?: string,
  ): Promise<CompanyEntity> {
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
}
