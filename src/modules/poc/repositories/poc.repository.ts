import { Injectable } from '@nestjs/common';
import {
  BaseRepository,
  PaginatedResult,
  PaginationOptions,
  TransactionService,
} from '@new-hros/libs-sql';
import { FindOptionsWhere, In, Not } from 'typeorm';
import { MasterDataStatus } from '../../../enums';
import { PocEntity } from '../entities/poc.entity';

@Injectable()
export class PocRepository extends BaseRepository<PocEntity> {
  constructor(transactionService: TransactionService) {
    super(PocEntity, transactionService);
  }

  async findByCompanyAndType(companyId: string, pocType: string): Promise<PocEntity | null> {
    return this.findOne({
      companyId,
      pocType,
      status: Not(MasterDataStatus.INACTIVE),
    });
  }

  async findActiveByCompany(companyId: string): Promise<PocEntity[]> {
    return this.find(
      {
        companyId,
        status: MasterDataStatus.ACTIVE,
      },
      {
        order: { pocType: 1 },
      },
    );
  }

  async findActiveOrScheduledByCompany(companyId: string): Promise<PocEntity[]> {
    return this.find(
      {
        companyId,
        status: In([MasterDataStatus.ACTIVE, MasterDataStatus.SCHEDULED]),
      },
      {
        order: { pocType: 1 },
      },
    );
  }

  async hasActiveOrScheduled(companyId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: {
        companyId,
        status: Not(MasterDataStatus.INACTIVE),
      },
    });
    return count > 0;
  }

  async findHistoryByCompany(
    companyId: string,
    options?: PaginationOptions & { pocType?: string },
  ): Promise<PaginatedResult<PocEntity>> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, Math.min(100, options?.limit || 20));

    const where: FindOptionsWhere<PocEntity> = {
      companyId,
    };
    if (options?.pocType) {
      where.pocType = options.pocType;
    }

    return this.find(where, {
      pagination: { page, limit },
      order: { createdAt: -1 },
    });
  }

  async updateStatus(id: string, status: MasterDataStatus, userId?: string): Promise<PocEntity> {
    const poc = await this.findById(id, { required: true });

    poc.status = status;
    if (userId) {
      poc.updatedBy = userId;
    }

    return this.update(id, poc);
  }

  async updateFields(id: string, fields: Partial<PocEntity>, userId?: string): Promise<PocEntity> {
    const poc = await this.findById(id, { required: true });

    Object.assign(poc, fields);
    if (userId) {
      poc.updatedBy = userId;
    }

    return this.repository.save(poc);
  }
}
