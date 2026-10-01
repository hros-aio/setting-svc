import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ description: 'Department code', example: 'ENG_V2' })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional({ description: 'Department name', example: 'Engineering & Product' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Department description',
    example: 'Updated department description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Parent department UUID',
    nullable: true,
    example: 'dept-123',
  })
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsUUID()
  @IsOptional()
  parentDepartmentId?: string | null;

  @ApiProperty({ description: 'Future effective date (YYYY-MM-DD)', example: '2026-10-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}
