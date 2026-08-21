import { EntityManager } from 'typeorm';
import { JobTitle } from '@new-hros/libs-sql';
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
  ): Promise<JobTitle | null>;

  findByCode(
    tenantId: string,
    companyId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<JobTitle | null>;

  find(
    tenantId: string,
    companyId: string,
    pagination?: JobTitlePaginationOptions,
    manager?: EntityManager,
  ): Promise<JobTitlePaginatedResult<JobTitle>>;

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

  createAndSave(jobTitleData: Partial<JobTitle>, manager?: EntityManager): Promise<JobTitle>;

  updateStatus(
    tenantId: string,
    companyId: string,
    id: string,
    status: MasterDataStatus,
    userId?: string,
    manager?: EntityManager,
  ): Promise<JobTitle>;

  updateFields(
    tenantId: string,
    companyId: string,
    id: string,
    fields: Partial<JobTitle>,
    userId?: string,
    manager?: EntityManager,
  ): Promise<JobTitle>;

  save(jobTitle: JobTitle, manager?: EntityManager): Promise<JobTitle>;
}
