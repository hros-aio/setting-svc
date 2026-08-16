import { EntityManager } from 'typeorm';
import { DepartmentEntity } from '../entities/department.entity';
import { MasterDataStatus } from '../../../enums';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  asTree?: boolean;
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

export interface DepartmentTreeNode extends DepartmentEntity {
  children: DepartmentTreeNode[];
}

export interface IDepartmentRepository {
  findById(
    tenantId: string,
    companyId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<DepartmentEntity | null>;

  findByCode(
    tenantId: string,
    companyId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<DepartmentEntity | null>;

  findActiveDepartments(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<DepartmentEntity>>;

  findAllDepartments(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<DepartmentEntity>>;

  findActiveDepartmentTree(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<DepartmentTreeNode[]>;

  hasActiveOrScheduled(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<boolean>;

  countAllDepartmentsByCompany(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<number>;

  findAncestorChain(
    tenantId: string,
    companyId: string,
    parentDepartmentId: string,
    maxDepth?: number,
    manager?: EntityManager,
  ): Promise<string[]>;

  createAndSave(
    departmentData: Partial<DepartmentEntity>,
    manager?: EntityManager,
  ): Promise<DepartmentEntity>;

  updateStatus(
    tenantId: string,
    companyId: string,
    id: string,
    status: MasterDataStatus,
    userId?: string,
    manager?: EntityManager,
  ): Promise<DepartmentEntity>;

  updateFields(
    tenantId: string,
    companyId: string,
    id: string,
    fields: Partial<DepartmentEntity>,
    userId?: string,
    manager?: EntityManager,
  ): Promise<DepartmentEntity>;

  save(department: DepartmentEntity, manager?: EntityManager): Promise<DepartmentEntity>;
}
