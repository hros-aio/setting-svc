import { EntityManager } from 'typeorm';
import { EmployeeReferenceEntity } from '../entities/employee-reference.entity';

export interface IEmployeeReferenceRepository {
  findByEmployeeId(
    tenantId: string,
    employeeId: string,
    manager?: EntityManager,
  ): Promise<EmployeeReferenceEntity | null>;

  findByCompanyAndEmployeeId(
    tenantId: string,
    companyId: string,
    employeeId: string,
    manager?: EntityManager,
  ): Promise<EmployeeReferenceEntity | null>;

  findByEmployeeIds(
    tenantId: string,
    employeeIds: string[],
    manager?: EntityManager,
  ): Promise<EmployeeReferenceEntity[]>;
}
