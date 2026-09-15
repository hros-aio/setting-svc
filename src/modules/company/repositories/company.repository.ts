import { Injectable } from '@nestjs/common';
import { BaseRepository, TransactionService } from '@new-hros/libs-sql';
import { CompanyEntity } from '../entities/company.entity';

@Injectable()
export class CompanyRepository extends BaseRepository<CompanyEntity> {
  constructor(transactionService: TransactionService) {
    super(CompanyEntity, transactionService);
  }

  async findByIdWithSetupSteps(id: string): Promise<CompanyEntity | null> {
    return this.findById(id, {
      relationLoadStrategy: 'query',
      relations: ['setupSteps'],
    });
  }

  async findTemplateCompany(): Promise<CompanyEntity | null> {
    return this.findOne({ isTemplate: true });
  }

  async existsByCode(companyCode: string): Promise<boolean> {
    return this.findOne({ companyCode }) !== null;
  }

  async clearTemplateDesignation(): Promise<void> {
    await this.repository.update(
      { isTemplate: true, tenantCode: this.tenantCode },
      {
        isTemplate: false,
      },
    );
  }

  async setTemplateDesignation(
    id: string,
    isTemplate: boolean,
    userId?: string,
  ): Promise<CompanyEntity> {
    return this.update(id, {
      isTemplate,
      updatedBy: userId,
    });
  }
}
