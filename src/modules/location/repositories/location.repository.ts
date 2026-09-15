import { Injectable } from '@nestjs/common';
import { BaseRepository, Location, PaginatedResult, TransactionService } from '@new-hros/libs-sql';
import { FindOptionsWhere, In, Not } from 'typeorm';
import { MasterDataStatus } from '../../../enums';
import { PaginationOptions } from './location.repository.interface';

@Injectable()
export class LocationRepository extends BaseRepository<Location> {
  constructor(transactionService: TransactionService) {
    super(Location, transactionService);
  }

  async findByCode(companyId: string, code: string): Promise<Location | null> {
    return this.findOne({
      companyId,
      code,
    });
  }

  async findActive(
    companyId: string,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Location>> {
    return this.find(
      {
        companyId,
        status: MasterDataStatus.ACTIVE,
      },
      {
        pagination: {
          page: pagination?.page ?? 1,
          limit: pagination?.limit ?? 10,
        },
        order: { name: 1 },
      },
    );
  }

  async hasActiveLocations(companyId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: {
        tenantCode: this.tenantCode,
        companyId,
        status: MasterDataStatus.ACTIVE,
      },
    });
    return count > 0;
  }

  async countAllLocationsByCompany(companyId: string): Promise<number> {
    return this.repository.count({
      where: {
        tenantCode: this.tenantCode,
        companyId,
      },
      withDeleted: true,
    });
  }

  async hasActiveOrScheduledHeadquarter(
    companyId: string,
    excludeLocationId?: string,
  ): Promise<boolean> {
    const where: FindOptionsWhere<Location> = {
      tenantCode: this.tenantCode,
      companyId,
      isHeadquarter: true,
      status: In([MasterDataStatus.ACTIVE, MasterDataStatus.SCHEDULED]),
    };

    if (excludeLocationId) {
      where.id = Not(excludeLocationId);
    }

    const count = await this.repository.count({ where });
    return count > 0;
  }

  async updateStatus(id: string, status: MasterDataStatus, userId?: string): Promise<Location> {
    const location = await this.findById(id, { required: true });

    location.status = status;
    if (userId) {
      location.updatedBy = userId;
    }

    return this.update(id, location);
  }

  async updateFields(id: string, fields: Partial<Location>, userId?: string): Promise<Location> {
    const location = await this.findById(id, { required: true });

    Object.assign(location, fields);
    if (userId) {
      location.updatedBy = userId;
    }

    return this.repository.save(location);
  }
}
