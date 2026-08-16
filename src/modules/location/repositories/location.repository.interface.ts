import { EntityManager } from 'typeorm';
import { LocationEntity } from '../entities/location.entity';
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
  ): Promise<LocationEntity | null>;

  findByCode(
    tenantId: string,
    companyId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<LocationEntity | null>;

  findActiveLocations(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<LocationEntity>>;

  findAllLocations(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<LocationEntity>>;

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

  createAndSave(
    locationData: Partial<LocationEntity>,
    manager?: EntityManager,
  ): Promise<LocationEntity>;

  updateStatus(
    tenantId: string,
    companyId: string,
    id: string,
    status: MasterDataStatus,
    userId?: string,
    manager?: EntityManager,
  ): Promise<LocationEntity>;

  updateFields(
    tenantId: string,
    companyId: string,
    id: string,
    fields: Partial<LocationEntity>,
    userId?: string,
    manager?: EntityManager,
  ): Promise<LocationEntity>;

  save(location: LocationEntity, manager?: EntityManager): Promise<LocationEntity>;
}
