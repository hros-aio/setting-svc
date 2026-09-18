import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class QueryPendingTransferDto {
  @IsUUID()
  employeeId: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class QueryEmployeeTransferDto {
  @IsUUID()
  employeeId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page: number = 0;
}
