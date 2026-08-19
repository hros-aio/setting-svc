import { EntityManager } from 'typeorm';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';

export interface EmployeeTransferPaginationOptions {
  limit?: number;
  offset?: number;
}

export interface EmployeeTransferPaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface IEmployeeTransferRepository {
  findById(
    tenantId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<EmployeeTransferEntity | null>;

  findPendingByEmployeeId(
    tenantId: string,
    employeeId: string,
    manager?: EntityManager,
  ): Promise<EmployeeTransferEntity | null>;

  findHistoryByEmployeeId(
    tenantId: string,
    employeeId: string,
    options?: EmployeeTransferPaginationOptions,
    manager?: EntityManager,
  ): Promise<EmployeeTransferPaginatedResult<EmployeeTransferEntity>>;

  createAndSave(
    data: Partial<EmployeeTransferEntity>,
    manager?: EntityManager,
  ): Promise<EmployeeTransferEntity>;

  save(entity: EmployeeTransferEntity, manager?: EntityManager): Promise<EmployeeTransferEntity>;
}
