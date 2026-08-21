import { EntityManager } from 'typeorm';
import { Grade } from '@new-hros/libs-sql';
import { MasterDataStatus } from '../../../enums';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
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

export interface IGradeRepository {
  findById(
    tenantId: string,
    companyId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<Grade | null>;

  findByCode(
    tenantId: string,
    companyId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<Grade | null>;

  find(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<Grade>>;

  hasActiveOrScheduled(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<boolean>;

  countAllGradesByCompany(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<number>;

  createAndSave(gradeData: Partial<Grade>, manager?: EntityManager): Promise<Grade>;

  updateStatus(
    tenantId: string,
    companyId: string,
    id: string,
    status: MasterDataStatus,
    userId?: string,
    manager?: EntityManager,
  ): Promise<Grade>;

  updateFields(
    tenantId: string,
    companyId: string,
    id: string,
    fields: Partial<Grade>,
    userId?: string,
    manager?: EntityManager,
  ): Promise<Grade>;

  save(grade: Grade, manager?: EntityManager): Promise<Grade>;
}
