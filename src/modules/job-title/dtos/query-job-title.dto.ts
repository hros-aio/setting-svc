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

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @IsOptional()
  @IsUUID('4')
  gradeId?: string;
}
