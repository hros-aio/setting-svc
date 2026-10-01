import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateJobTitleDto {
  @ApiProperty({ description: 'Unique job title code within company', example: 'SE-L3' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code: string;

  @ApiProperty({ description: 'Job title name', example: 'Senior Software Engineer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Department UUID', example: 'dept-123' })
  @IsUUID('4')
  @IsNotEmpty()
  departmentId: string;

  @ApiProperty({ description: 'Grade UUID', example: 'grade-123' })
  @IsUUID('4')
  @IsNotEmpty()
  gradeId: string;

  @ApiPropertyOptional({ description: 'Job title description', example: 'Senior engineering role' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Future effective start date (YYYY-MM-DD)', example: '2026-10-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}
