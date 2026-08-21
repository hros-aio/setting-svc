import { EntityManager } from 'typeorm';
import { Department } from '@new-hros/libs-sql';
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

export interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[];
}

export interface IDepartmentRepository {
  findById(
    tenantId: string,
    companyId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<Department | null>;

  findByCode(
    tenantId: string,
    companyId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<Department | null>;

  findActiveDepartments(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<Department>>;

  findAllDepartments(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<Department>>;

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

  createAndSave(departmentData: Partial<Department>, manager?: EntityManager): Promise<Department>;

  updateStatus(
    tenantId: string,
    companyId: string,
    id: string,
    status: MasterDataStatus,
    userId?: string,
    manager?: EntityManager,
  ): Promise<Department>;

  updateFields(
    tenantId: string,
    companyId: string,
    id: string,
    fields: Partial<Department>,
    userId?: string,
    manager?: EntityManager,
  ): Promise<Department>;

  save(department: Department, manager?: EntityManager): Promise<Department>;
}
