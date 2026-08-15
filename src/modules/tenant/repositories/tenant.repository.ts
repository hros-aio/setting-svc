import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TenantEntity } from '../entities/tenant.entity';

@Injectable()
export class TenantRepository extends Repository<TenantEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(TenantEntity, dataSource.createEntityManager());
  }

  async findByTenantId(tenantId: string, manager?: EntityManager): Promise<TenantEntity | null> {
    const repo = manager ? manager.getRepository(TenantEntity) : this;
    return repo.findOne({ where: { tenantId } });
  }

  async findByTenantCode(
    tenantCode: string,
    manager?: EntityManager,
  ): Promise<TenantEntity | null> {
    const repo = manager ? manager.getRepository(TenantEntity) : this;
    return repo.findOne({ where: { tenantCode } });
  }

  async upsertTenant(
    tenantData: Partial<TenantEntity>,
    manager?: EntityManager,
  ): Promise<TenantEntity> {
    const repo = manager ? manager.getRepository(TenantEntity) : this;
    let tenant = await repo.findOne({
      where: [
        ...(tenantData.tenantId ? [{ tenantId: tenantData.tenantId }] : []),
        ...(tenantData.tenantCode ? [{ tenantCode: tenantData.tenantCode }] : []),
      ],
    });

    if (tenant) {
      Object.assign(tenant, tenantData);
      return repo.save(tenant);
    }

    tenant = repo.create(tenantData);
    return repo.save(tenant);
  }
}
