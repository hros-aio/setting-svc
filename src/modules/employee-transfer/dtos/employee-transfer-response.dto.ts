import { EmployeeTransferStatus } from '../../../enums';

export class EmployeeTransferResponseDto {
  id: string;
  tenantId: string;
  employeeId: string;
  sourceCompanyId: string;
  sourceCompanyName?: string;
  destinationCompanyId: string;
  destinationCompanyName?: string;
  destinationLocationId?: string;
  destinationDepartmentId?: string;
  destinationGradeId?: string;
  destinationJobTitleId?: string;
  status: EmployeeTransferStatus;
  effectiveAt: Date;
  completedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
