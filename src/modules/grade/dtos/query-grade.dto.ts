import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DeactivateGradeDto {
  @ApiProperty({ description: 'Future effective deactivation date (YYYY-MM-DD)', example: '2026-10-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}

export enum GradeStatusFilter {
  ACTIVE = 'active',
  SCHEDULED = 'scheduled',
  INACTIVE = 'inactive',
  ALL = 'all',
}

export class QueryGradeDto {
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

  @ApiPropertyOptional({ description: 'Search term for name or code', example: 'L3' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Status filter',
    enum: GradeStatusFilter,
    default: GradeStatusFilter.ACTIVE,
    example: GradeStatusFilter.ACTIVE,
  })
  @IsOptional()
  @IsString()
  status?: string = 'active';
}

