import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PocType } from '../../../enums';

export class QueryPocDto {
  @ApiPropertyOptional({
    description: 'Filter by Point of Contact type',
    enum: PocType,
    example: PocType.HR_HEAD,
  })
  @IsEnum(PocType)
  @IsOptional()
  pocType?: PocType;

  @ApiPropertyOptional({ description: 'Page number', default: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

