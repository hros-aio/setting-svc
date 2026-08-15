import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CompanyEntity } from '../entities/company.entity';

@Injectable()
export class CompanyRepository extends Repository<CompanyEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(CompanyEntity, dataSource.createEntityManager());
  }

  async findByIdAndTenant(
    id: string,
    tenantId: string,
    manager?: EntityManager,
  ): Promise<CompanyEntity | null> {
    const repo = manager ? manager.getRepository(CompanyEntity) : this;
    return repo.findOne({
      where: { id, tenantId },
      relations: ['setupSteps'],
    });
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
    const updated = await repo.findOne({
      where: { id, tenantId },
      relations: ['setupSteps'],
    });
    return updated!;
  }
}
