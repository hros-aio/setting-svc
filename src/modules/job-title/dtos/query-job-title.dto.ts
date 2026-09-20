import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DeactivateJobTitleDto {
  @ApiProperty({ description: 'Future effective deactivation date (YYYY-MM-DD)', example: '2026-10-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}

export enum JobTitleStatusFilter {
  ACTIVE = 'active',
  SCHEDULED = 'scheduled',
  INACTIVE = 'inactive',
  ALL = 'all',
}

export class QueryJobTitleDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search term for name or code', example: 'Engineer' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Status filter',
    enum: JobTitleStatusFilter,
    default: JobTitleStatusFilter.ACTIVE,
    example: JobTitleStatusFilter.ACTIVE,
  })
  @IsOptional()
  @IsString()
  status?: string = 'active';

  @ApiPropertyOptional({ description: 'Department UUID filter', example: 'dept-123' })
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Grade UUID filter', example: 'grade-123' })
  @IsOptional()
  @IsUUID('4')
  gradeId?: string;
}

