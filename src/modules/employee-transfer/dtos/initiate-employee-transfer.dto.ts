import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class InitiateEmployeeTransferDto {
  @ApiProperty({ description: 'Source Company UUID', example: 'comp-123' })
  @IsUUID()
  companyId: string;

  @ApiProperty({ description: 'Employee UUID to transfer', example: 'emp-123' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ description: 'Destination Company UUID', example: 'comp-456' })
  @IsUUID()
  destinationCompanyId: string;

  @ApiPropertyOptional({ description: 'Destination Location UUID', example: 'loc-123' })
  @IsOptional()
  @IsUUID()
  destinationLocationId?: string;

  @ApiPropertyOptional({ description: 'Destination Department UUID', example: 'dept-123' })
  @IsOptional()
  @IsUUID()
  destinationDepartmentId?: string;

  @ApiPropertyOptional({ description: 'Destination Grade UUID', example: 'grade-123' })
  @IsOptional()
  @IsUUID()
  destinationGradeId?: string;

  @ApiPropertyOptional({ description: 'Destination Job Title UUID', example: 'job-123' })
  @IsOptional()
  @IsUUID()
  destinationJobTitleId?: string;

  @ApiProperty({ description: 'Future effective date (YYYY-MM-DD)', example: '2026-10-01' })
  @IsDateString()
  effectiveAt: string;

  @ApiPropertyOptional({ description: 'Transfer notes', example: 'Internal mobility transfer' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
