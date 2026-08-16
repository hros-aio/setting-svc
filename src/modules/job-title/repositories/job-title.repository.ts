import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { JobTitleEntity } from '../entities/job-title.entity';
import {
  IJobTitleRepository,
  JobTitlePaginatedResult,
  JobTitlePaginationOptions,
} from './job-title.repository.interface';
import { MasterDataStatus } from '../../../enums';

@Injectable()
export class JobTitleRepository implements IJobTitleRepository {
  constructor(
    @InjectRepository(JobTitleEntity)
    private readonly repo: Repository<JobTitleEntity>,
    private readonly dataSource: DataSource,
  ) {}

  private getRepo(manager?: EntityManager): Repository<JobTitleEntity> {
    return manager ? manager.getRepository(JobTitleEntity) : this.repo;
  }

  async findById(
    tenantId: string,
    companyId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<JobTitleEntity | null> {
    return this.getRepo(manager).findOne({
      where: {
        id,
        tenantId,
        companyId,
      },
      relations: ['department', 'grade', 'sourceJobTitle'],
    });
  }

  async findByCode(
    tenantId: string,
    companyId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<JobTitleEntity | null> {
    return this.getRepo(manager).findOne({
      where: {
        tenantId,
        companyId,
        code,
      },
      relations: ['department', 'grade'],
    });
  }

  async find(
    tenantId: string,
    companyId: string,
    pagination?: JobTitlePaginationOptions,
    manager?: EntityManager,
  ): Promise<JobTitlePaginatedResult<JobTitleEntity>> {
    const page = pagination?.page && pagination.page > 0 ? Number(pagination.page) : 1;
    const limit = pagination?.limit && pagination.limit > 0 ? Number(pagination.limit) : 20;
    const skip = (page - 1) * limit;

    const baseWhere: FindOptionsWhere<JobTitleEntity> = {
      tenantId,
      companyId,
    };

    if (pagination?.status && pagination.status !== 'all') {
      baseWhere.status = pagination.status as MasterDataStatus;
    } else if (!pagination?.status) {
      baseWhere.status = MasterDataStatus.ACTIVE;
    }

    if (pagination?.departmentId) {
      baseWhere.departmentId = pagination.departmentId;
    }

    if (pagination?.gradeId) {
      baseWhere.gradeId = pagination.gradeId;
    }

    let where: FindOptionsWhere<JobTitleEntity> | FindOptionsWhere<JobTitleEntity>[] = baseWhere;
    if (pagination?.search) {
      where = [
        { ...baseWhere, name: ILike(`%${pagination.search}%`) },
        { ...baseWhere, code: ILike(`%${pagination.search}%`) },
      ];
    }

    const [data, total] = await this.getRepo(manager).findAndCount({
      where,
      order: {
        name: 'ASC',
      },
      skip,
      take: limit,
      relations: ['department', 'grade', 'sourceJobTitle'],
    });

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

  async hasActiveOrScheduled(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const count = await this.getRepo(manager).count({
      where: {
        tenantId,
        companyId,
        status: In([MasterDataStatus.ACTIVE, MasterDataStatus.SCHEDULED]),
      },
    });

    return count > 0;
  }

  async countAllJobTitlesByCompany(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<number> {
    return this.getRepo(manager).count({
      where: {
        tenantId,
        companyId,
      },
    });
  }

  async createAndSave(
    jobTitleData: Partial<JobTitleEntity>,
    manager?: EntityManager,
  ): Promise<JobTitleEntity> {
    const repo = this.getRepo(manager);
    const jobTitle = repo.create(jobTitleData);
    return repo.save(jobTitle);
  }

  async updateStatus(
    tenantId: string,
    companyId: string,
    id: string,
    status: MasterDataStatus,
    userId?: string,
    manager?: EntityManager,
  ): Promise<JobTitleEntity> {
    const repo = this.getRepo(manager);
    const jobTitle = await this.findById(tenantId, companyId, id, manager);
    if (!jobTitle) {
      throw new NotFoundException(`Job Title with ID '${id}' not found`);
    }

    jobTitle.status = status;
    if (userId) {
      jobTitle.updatedBy = userId;
    }

    return repo.save(jobTitle);
  }

  async updateFields(
    tenantId: string,
    companyId: string,
    id: string,
    fields: Partial<JobTitleEntity>,
    userId?: string,
    manager?: EntityManager,
  ): Promise<JobTitleEntity> {
    const repo = this.getRepo(manager);
    const jobTitle = await this.findById(tenantId, companyId, id, manager);
    if (!jobTitle) {
      throw new NotFoundException(`Job Title with ID '${id}' not found`);
    }

    Object.assign(jobTitle, fields);
    if (userId) {
      jobTitle.updatedBy = userId;
    }

    return repo.save(jobTitle);
  }

  async save(jobTitle: JobTitleEntity, manager?: EntityManager): Promise<JobTitleEntity> {
    const repo = this.getRepo(manager);
    return repo.save(jobTitle);
  }
}
