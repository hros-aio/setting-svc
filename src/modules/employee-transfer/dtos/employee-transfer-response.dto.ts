import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeTransferStatus } from '../../../enums';

export class EmployeeTransferResponseDto {
  @ApiProperty({ description: 'Transfer record UUID', example: 'trans-123' })
  id: string;

  @ApiProperty({ description: 'Transferred Employee UUID', example: 'emp-123' })
  employeeId: string;

  @ApiProperty({ description: 'Source Company UUID', example: 'comp-123' })
  sourceCompanyId: string;

  @ApiPropertyOptional({ description: 'Source Company name', example: 'Acme Corp' })
  sourceCompanyName?: string;

  @ApiProperty({ description: 'Destination Company UUID', example: 'comp-456' })
  destinationCompanyId: string;

  @ApiPropertyOptional({ description: 'Destination Company name', example: 'Acme Logistics' })
  destinationCompanyName?: string;

  @ApiPropertyOptional({ description: 'Destination Location UUID', example: 'loc-123' })
  destinationLocationId?: string;

  @ApiPropertyOptional({ description: 'Destination Department UUID', example: 'dept-123' })
  destinationDepartmentId?: string;

  @ApiPropertyOptional({ description: 'Destination Grade UUID', example: 'grade-123' })
  destinationGradeId?: string;

  @ApiPropertyOptional({ description: 'Destination Job Title UUID', example: 'job-123' })
  destinationJobTitleId?: string;

  @ApiProperty({
    description: 'Status of employee transfer',
    enum: EmployeeTransferStatus,
    example: EmployeeTransferStatus.PENDING,
  })
  status: EmployeeTransferStatus;

  @ApiProperty({ description: 'Effective date of transfer', example: '2026-10-01T00:00:00.000Z' })
  effectiveAt: Date;

  @ApiPropertyOptional({ description: 'Completion timestamp', example: '2026-10-01T00:00:00.000Z' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Transfer notes', example: 'Internal mobility transfer' })
  notes?: string;

  @ApiProperty({ description: 'Creation timestamp', example: '2026-09-20T04:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Update timestamp', example: '2026-09-20T04:00:00.000Z' })
  updatedAt: Date;
}

