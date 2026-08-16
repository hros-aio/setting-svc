import { EntityManager } from 'typeorm';
import { JobTitleEntity } from '../entities/job-title.entity';
import { MasterDataStatus } from '../../../enums';

export interface JobTitlePaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  departmentId?: string;
  gradeId?: string;
}

export interface JobTitlePaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IJobTitleRepository {
  findById(
    tenantId: string,
    companyId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<JobTitleEntity | null>;

  findByCode(
    tenantId: string,
    companyId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<JobTitleEntity | null>;

  find(
    tenantId: string,
    companyId: string,
    pagination?: JobTitlePaginationOptions,
    manager?: EntityManager,
  ): Promise<JobTitlePaginatedResult<JobTitleEntity>>;

  hasActiveOrScheduled(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<boolean>;

  countAllJobTitlesByCompany(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<number>;

  createAndSave(
    jobTitleData: Partial<JobTitleEntity>,
    manager?: EntityManager,
  ): Promise<JobTitleEntity>;

  updateStatus(
    tenantId: string,
    companyId: string,
    id: string,
    status: MasterDataStatus,
    userId?: string,
    manager?: EntityManager,
  ): Promise<JobTitleEntity>;

  updateFields(
    tenantId: string,
    companyId: string,
    id: string,
    fields: Partial<JobTitleEntity>,
    userId?: string,
    manager?: EntityManager,
  ): Promise<JobTitleEntity>;

  save(jobTitle: JobTitleEntity, manager?: EntityManager): Promise<JobTitleEntity>;
}
