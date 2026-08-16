import { EntityManager } from 'typeorm';
import { GradeEntity } from '../entities/grade.entity';
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
  ): Promise<GradeEntity | null>;

  findByCode(
    tenantId: string,
    companyId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<GradeEntity | null>;

  find(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<GradeEntity>>;

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

  createAndSave(gradeData: Partial<GradeEntity>, manager?: EntityManager): Promise<GradeEntity>;

  updateStatus(
    tenantId: string,
    companyId: string,
    id: string,
    status: MasterDataStatus,
    userId?: string,
    manager?: EntityManager,
  ): Promise<GradeEntity>;

  updateFields(
    tenantId: string,
    companyId: string,
    id: string,
    fields: Partial<GradeEntity>,
    userId?: string,
    manager?: EntityManager,
  ): Promise<GradeEntity>;

  save(grade: GradeEntity, manager?: EntityManager): Promise<GradeEntity>;
}
