import { EntityManager } from 'typeorm';
import { PocEntity } from '../entities/poc.entity';

export interface PocHistoryPaginationOptions {
  page?: number;
  limit?: number;
  pocType?: string;
}

export interface PocPaginatedResult<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IPocRepository {
  findById(
    tenantId: string,
    companyId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<PocEntity | null>;

  findByCompanyAndType(
    tenantId: string,
    companyId: string,
    pocType: string,
    manager?: EntityManager,
  ): Promise<PocEntity | null>;

  findActiveByCompany(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<PocEntity[]>;

  findActiveOrScheduledByCompany(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<PocEntity[]>;

  hasActiveOrScheduled(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<boolean>;

  findHistory(
    tenantId: string,
    companyId: string,
    options?: PocHistoryPaginationOptions,
    manager?: EntityManager,
  ): Promise<PocPaginatedResult<PocEntity>>;

  createAndSave(data: Partial<PocEntity>, manager?: EntityManager): Promise<PocEntity>;

  save(entity: PocEntity, manager?: EntityManager): Promise<PocEntity>;
}
