import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, Not, Repository } from 'typeorm';
import { Location } from '@new-hros/libs-sql';
import {
  ILocationRepository,
  PaginatedResult,
  PaginationOptions,
} from './location.repository.interface';
import { MasterDataStatus } from '../../../enums';

@Injectable()
export class LocationRepository implements ILocationRepository {
  constructor(
    @InjectRepository(Location)
    private readonly repo: Repository<Location>,
    private readonly dataSource: DataSource,
  ) {}

  private getRepo(manager?: EntityManager): Repository<Location> {
    return manager ? manager.getRepository(Location) : this.repo;
  }

  async findById(
    tenantId: string,
    companyId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<Location | null> {
    return this.getRepo(manager).findOne({
      where: {
        id,
        tenantId,
        companyId,
      },
    });
  }

  async findByCode(
    tenantId: string,
    companyId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<Location | null> {
    return this.getRepo(manager).findOne({
      where: {
        tenantId,
        companyId,
        code,
      },
    });
  }

  async findActiveLocations(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<Location>> {
    const page = pagination?.page && pagination.page > 0 ? pagination.page : 1;
    const limit = pagination?.limit && pagination.limit > 0 ? pagination.limit : 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.getRepo(manager)
      .createQueryBuilder('location')
      .where('location.tenant_id = :tenantId', { tenantId })
      .andWhere('location.company_id = :companyId', { companyId })
      .andWhere('location.status = :status', { status: MasterDataStatus.ACTIVE });

    if (pagination?.search) {
      queryBuilder.andWhere('(location.name ILIKE :search OR location.code ILIKE :search)', {
        search: `%${pagination.search}%`,
      });
    }

    queryBuilder.orderBy('location.name', 'ASC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findAllLocations(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<Location>> {
    const page = pagination?.page && pagination.page > 0 ? pagination.page : 1;
    const limit = pagination?.limit && pagination.limit > 0 ? pagination.limit : 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.getRepo(manager)
      .createQueryBuilder('location')
      .where('location.tenant_id = :tenantId', { tenantId })
      .andWhere('location.company_id = :companyId', { companyId });

    if (pagination?.search) {
      queryBuilder.andWhere('(location.name ILIKE :search OR location.code ILIKE :search)', {
        search: `%${pagination.search}%`,
      });
    }

    queryBuilder.orderBy('location.created_at', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async hasActiveLocations(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const count = await this.getRepo(manager).count({
      where: {
        tenantId,
        companyId,
        status: MasterDataStatus.ACTIVE,
      },
    });
    return count > 0;
  }

  async countAllLocationsByCompany(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<number> {
    return this.getRepo(manager).count({
      where: {
        tenantId,
        companyId,
      },
      withDeleted: true,
    });
  }

  async hasActiveOrScheduledHeadquarter(
    tenantId: string,
    companyId: string,
    excludeLocationId?: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const where: FindOptionsWhere<Location> = {
      tenantId,
      companyId,
      isHeadquarter: true,
      status: In([MasterDataStatus.ACTIVE, MasterDataStatus.SCHEDULED]),
    };

    if (excludeLocationId) {
      where.id = Not(excludeLocationId);
    }

    const count = await this.getRepo(manager).count({ where });
    return count > 0;
  }

  async createAndSave(locationData: Partial<Location>, manager?: EntityManager): Promise<Location> {
    const repo = this.getRepo(manager);
    const location = repo.create(locationData);
    return repo.save(location);
  }

  async updateStatus(
    tenantId: string,
    companyId: string,
    id: string,
    status: MasterDataStatus,
    userId?: string,
    manager?: EntityManager,
  ): Promise<Location> {
    const repo = this.getRepo(manager);
    const location = await this.findById(tenantId, companyId, id, manager);
    if (!location) {
      throw new NotFoundException(`Location with ID '${id}' not found`);
    }

    location.status = status;
    if (userId) {
      location.updatedBy = userId;
    }

    return repo.save(location);
  }

  async updateFields(
    tenantId: string,
    companyId: string,
    id: string,
    fields: Partial<Location>,
    userId?: string,
    manager?: EntityManager,
  ): Promise<Location> {
    const repo = this.getRepo(manager);
    const location = await this.findById(tenantId, companyId, id, manager);
    if (!location) {
      throw new NotFoundException(`Location with ID '${id}' not found`);
    }

    Object.assign(location, fields);
    if (userId) {
      location.updatedBy = userId;
    }

    return repo.save(location);
  }

  async save(location: Location, manager?: EntityManager): Promise<Location> {
    const repo = this.getRepo(manager);
    return repo.save(location);
  }
}
