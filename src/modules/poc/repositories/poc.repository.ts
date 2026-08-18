import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { MasterDataStatus } from '../../../enums';
import { PocEntity } from '../entities/poc.entity';
import {
  IPocRepository,
  PocHistoryPaginationOptions,
  PocPaginatedResult,
} from './poc.repository.interface';

@Injectable()
export class PocRepository implements IPocRepository {
  constructor(
    @InjectRepository(PocEntity)
    private readonly repo: Repository<PocEntity>,
  ) {}

  private getRepo(manager?: EntityManager): Repository<PocEntity> {
    return manager ? manager.getRepository(PocEntity) : this.repo;
  }

  async findById(
    tenantId: string,
    companyId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<PocEntity | null> {
    return this.getRepo(manager).findOne({
      where: {
        id,
        tenantId,
        companyId,
      },
    });
  }

  async findByCompanyAndType(
    tenantId: string,
    companyId: string,
    pocType: string,
    manager?: EntityManager,
  ): Promise<PocEntity | null> {
    return this.getRepo(manager).findOne({
      where: {
        tenantId,
        companyId,
        pocType,
        status: Not(MasterDataStatus.INACTIVE),
      },
    });
  }

  async findActiveByCompany(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<PocEntity[]> {
    return this.getRepo(manager).find({
      where: {
        tenantId,
        companyId,
        status: MasterDataStatus.ACTIVE,
      },
      order: {
        pocType: 'ASC',
      },
    });
  }

  async findActiveOrScheduledByCompany(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<PocEntity[]> {
    return this.getRepo(manager).find({
      where: {
        tenantId,
        companyId,
        status: In([MasterDataStatus.ACTIVE, MasterDataStatus.SCHEDULED]),
      },
      order: {
        pocType: 'ASC',
      },
    });
  }

  async hasActiveOrScheduled(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const count = await this.getRepo(manager).count({
      where: {
        tenantId,
        companyId,
        status: Not(MasterDataStatus.INACTIVE),
      },
    });
    return count > 0;
  }

  async findHistory(
    tenantId: string,
    companyId: string,
    options?: PocHistoryPaginationOptions,
    manager?: EntityManager,
  ): Promise<PocPaginatedResult<PocEntity>> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, Math.min(100, options?.limit || 20));
    const skip = (page - 1) * limit;

    const qb = this.getRepo(manager)
      .createQueryBuilder('poc')
      .where('poc.tenant_id = :tenantId', { tenantId })
      .andWhere('poc.company_id = :companyId', { companyId });

    if (options?.pocType) {
      qb.andWhere('poc.poc_type = :pocType', { pocType: options.pocType });
    }

    qb.orderBy('poc.created_at', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async createAndSave(data: Partial<PocEntity>, manager?: EntityManager): Promise<PocEntity> {
    const repo = this.getRepo(manager);
    const entity = repo.create(data);
    return repo.save(entity);
  }

  async save(entity: PocEntity, manager?: EntityManager): Promise<PocEntity> {
    return this.getRepo(manager).save(entity);
  }
}
