import { EntityManager } from 'typeorm';
import { Location } from '@new-hros/libs-sql';
import { MasterDataStatus } from '../../../enums';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ILocationRepository {
  findById(
    tenantId: string,
    companyId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<Location | null>;

  findByCode(
    tenantId: string,
    companyId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<Location | null>;

  findActiveLocations(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<Location>>;

  findAllLocations(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<Location>>;

  hasActiveLocations(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<boolean>;

  countAllLocationsByCompany(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<number>;

  hasActiveOrScheduledHeadquarter(
    tenantId: string,
    companyId: string,
    excludeLocationId?: string,
    manager?: EntityManager,
  ): Promise<boolean>;

  createAndSave(locationData: Partial<Location>, manager?: EntityManager): Promise<Location>;

  updateStatus(
    tenantId: string,
    companyId: string,
    id: string,
    status: MasterDataStatus,
    userId?: string,
    manager?: EntityManager,
  ): Promise<Location>;

  updateFields(
    tenantId: string,
    companyId: string,
    id: string,
    fields: Partial<Location>,
    userId?: string,
    manager?: EntityManager,
  ): Promise<Location>;

  save(location: Location, manager?: EntityManager): Promise<Location>;
}
