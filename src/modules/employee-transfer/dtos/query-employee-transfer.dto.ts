import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class QueryPendingTransferDto {
  @ApiProperty({ description: 'Employee UUID', example: 'emp-123' })
  @IsUUID()
  employeeId: string;

  @ApiPropertyOptional({ description: 'Company UUID filter', example: 'comp-123' })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class QueryEmployeeTransferDto {
  @ApiProperty({ description: 'Employee UUID', example: 'emp-123' })
  @IsUUID()
  employeeId: string;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Page index (0-based)', default: 0, example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page: number = 0;
}

