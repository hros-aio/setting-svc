import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DeactivateGradeDto {
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
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string = 'active';
}
