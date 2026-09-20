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

export class UpdateJobTitleDto {
  @ApiPropertyOptional({ description: 'Job title code', example: 'SE-L3_V2' })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional({ description: 'Job title name', example: 'Lead Software Engineer' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Department UUID', example: 'dept-123' })
  @IsUUID('4')
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Grade UUID', example: 'grade-123' })
  @IsUUID('4')
  @IsOptional()
  gradeId?: string;

  @ApiPropertyOptional({ description: 'Job title description', nullable: true, example: 'Updated description' })
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({ description: 'Future effective date (YYYY-MM-DD)', example: '2026-10-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}

