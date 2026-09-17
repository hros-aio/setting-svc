import { Injectable } from '@nestjs/common';
import {
  BaseRepository,
  JobTitle,
  PaginatedResult,
  PaginationOptions,
  TransactionService,
} from '@new-hros/libs-sql';
import { FindOptionsWhere, ILike, In } from 'typeorm';
import { MasterDataStatus } from '../../../enums';

@Injectable()
export class JobTitleRepository extends BaseRepository<JobTitle> {
  constructor(transactionService: TransactionService) {
    super(JobTitle, transactionService);
  }

  async findByIdWithRelations(id: string): Promise<JobTitle | null> {
    return this.findById(id, {
      relations: ['department', 'grade', 'sourceJobTitle'],
    });
  }

  async findByCode(companyId: string, code: string): Promise<JobTitle | null> {
    return this.findOne(
      {
        companyId,
        code,
      },
      {
        relations: ['department', 'grade'],
      },
    );
  }

  async findActive(
    companyId: string,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<JobTitle>> {
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
        relations: ['department', 'grade', 'sourceJobTitle'],
      },
    );
  }

  async findJobTitles(
    companyId: string,
    pagination?: PaginationOptions,
    search?: string,
    status?: string,
    departmentId?: string,
    gradeId?: string,
  ): Promise<PaginatedResult<JobTitle>> {
    const baseWhere: FindOptionsWhere<JobTitle> = {
      companyId,
    };

    if (status && status !== 'all') {
      baseWhere.status = status as MasterDataStatus;
    } else if (!status) {
      baseWhere.status = MasterDataStatus.ACTIVE;
    }

    if (departmentId) {
      baseWhere.departmentId = departmentId;
    }

    if (gradeId) {
      baseWhere.gradeId = gradeId;
    }

    let where: FindOptionsWhere<JobTitle> | FindOptionsWhere<JobTitle>[] = baseWhere;
    if (search) {
      where = [
        { ...baseWhere, name: ILike(`%${search}%`) },
        { ...baseWhere, code: ILike(`%${search}%`) },
      ];
    }

    return this.find(where as FindOptionsWhere<JobTitle>, {
      pagination: {
        page: pagination?.page ?? 1,
        limit: pagination?.limit ?? 20,
      },
      order: {
        name: 1,
      },
      relations: ['department', 'grade', 'sourceJobTitle'],
    });
  }

  async hasActiveOrScheduled(companyId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: {
        tenantCode: this.tenantCode,
        companyId,
        status: In([MasterDataStatus.ACTIVE, MasterDataStatus.SCHEDULED]),
      },
    });
    return count > 0;
  }

  async countAllJobTitlesByCompany(companyId: string): Promise<number> {
    return this.repository.count({
      where: {
        tenantCode: this.tenantCode,
        companyId,
      },
      withDeleted: true,
    });
  }

  async updateStatus(id: string, status: MasterDataStatus, userId?: string): Promise<JobTitle> {
    const jobTitle = await this.findById(id, { required: true });

    jobTitle.status = status;
    if (userId) {
      jobTitle.updatedBy = userId;
    }

    return this.update(id, jobTitle);
  }

  async updateFields(id: string, fields: Partial<JobTitle>, userId?: string): Promise<JobTitle> {
    const jobTitle = await this.findById(id, { required: true });

    Object.assign(jobTitle, fields);
    if (userId) {
      jobTitle.updatedBy = userId;
    }

    return this.repository.save(jobTitle);
  }
}
