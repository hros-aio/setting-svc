import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateGradeDto {
  @ApiPropertyOptional({ description: 'Grade code', example: 'L3_V2' })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional({ description: 'Grade level name', example: 'Lead Engineer' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Grade description', example: 'Updated level 3 description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Rank order', nullable: true, example: 4 })
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsInt()
  @IsOptional()
  rankOrder?: number | null;

  @ApiProperty({ description: 'Future effective date (YYYY-MM-DD)', example: '2026-10-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}
