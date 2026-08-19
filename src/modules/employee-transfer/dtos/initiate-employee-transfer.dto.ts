import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class InitiateEmployeeTransferDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsUUID()
  companyId: string;

  @IsUUID()
  employeeId: string;

  @IsUUID()
  destinationCompanyId: string;

  @IsOptional()
  @IsUUID()
  destinationLocationId?: string;

  @IsOptional()
  @IsUUID()
  destinationDepartmentId?: string;

  @IsOptional()
  @IsUUID()
  destinationGradeId?: string;

  @IsOptional()
  @IsUUID()
  destinationJobTitleId?: string;

  @IsDateString()
  effectiveAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
