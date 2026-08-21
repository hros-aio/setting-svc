import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CompanyEntity } from '../entities/company.entity';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';

@Injectable()
export class CompanyRepository extends Repository<CompanyEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(CompanyEntity, dataSource.createEntityManager());
  }

  private async findOneWithSetupSteps(
    id: string,
    tenantId: string,
    manager?: EntityManager,
  ): Promise<CompanyEntity | null> {
    const companyRepo = manager ? manager.getRepository(CompanyEntity) : this;
    const company = await companyRepo.findOne({ where: { id, tenantId } });
    if (!company) {
      return null;
    }

    const setupStepRepo = (manager ?? this.manager).getRepository(CompanySetupStepEntity);
    company.setupSteps = await setupStepRepo.find({
      where: { companyId: id, tenantId },
      order: { stepOrder: 'ASC' },
    });
    return company;
  }

  async findByIdAndTenant(
    id: string,
    tenantId: string,
    manager?: EntityManager,
  ): Promise<CompanyEntity | null> {
    return this.findOneWithSetupSteps(id, tenantId, manager);
  }

  async findTemplateCompanyByTenantId(
    tenantId: string,
    manager?: EntityManager,
  ): Promise<CompanyEntity | null> {
    const repo = manager ? manager.getRepository(CompanyEntity) : this;
    return repo.findOne({ where: { tenantId, isTemplate: true } });
  }

  async existsByTenantAndCode(
    tenantId: string,
    companyCode: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repo = manager ? manager.getRepository(CompanyEntity) : this;
    const count = await repo.count({
      where: {
        tenantId,
        companyCode,
      },
    });
    return count > 0;
  }

  async createAndSave(
    companyData: Partial<CompanyEntity>,
    manager?: EntityManager,
  ): Promise<CompanyEntity> {
    const repo = manager ? manager.getRepository(CompanyEntity) : this;
    const company = repo.create(companyData);
    return repo.save(company);
  }

  async updateCompanyInfo(
    id: string,
    tenantId: string,
    updateData: Partial<CompanyEntity>,
    manager?: EntityManager,
  ): Promise<CompanyEntity> {
    const repo = manager ? manager.getRepository(CompanyEntity) : this;
    await repo.update(
      { id, tenantId },
      updateData as unknown as QueryDeepPartialEntity<CompanyEntity>,
    );
    const updated = await this.findOneWithSetupSteps(id, tenantId, manager);
    return updated!;
  }

  async clearTemplateDesignation(tenantId: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(CompanyEntity) : this;
    await repo.update(
      { tenantId, isTemplate: true },
      {
        isTemplate: false,
      },
    );
  }

  async setTemplateDesignation(
    companyId: string,
    tenantId: string,
    isTemplate: boolean,
    userId?: string,
    manager?: EntityManager,
  ): Promise<CompanyEntity> {
    const repo = manager ? manager.getRepository(CompanyEntity) : this;
    const updateData: QueryDeepPartialEntity<CompanyEntity> = { isTemplate };
    if (userId) {
      updateData.updatedBy = userId;
    }
    await repo.update({ id: companyId, tenantId }, updateData);
    const updated = await this.findOneWithSetupSteps(companyId, tenantId, manager);
    return updated!;
  }
}
