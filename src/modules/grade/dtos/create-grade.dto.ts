import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGradeDto {
  @ApiProperty({ description: 'Unique grade code within company', example: 'L3' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code: string;

  @ApiProperty({ description: 'Grade level name', example: 'Senior Engineer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Grade description',
    example: 'Level 3 individual contributor',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Numerical ranking order for sorting', example: 3 })
  @IsInt()
  @IsOptional()
  rankOrder?: number;

  @ApiProperty({ description: 'Future effective start date (YYYY-MM-DD)', example: '2026-10-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}
