import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ReplacePocDto {
  @ApiProperty({ description: 'Replacement Employee UUID', example: 'emp-456' })
  @IsUUID('4')
  @IsNotEmpty()
  newEmployeeId: string;

  @ApiProperty({ description: 'Future effective start date (YYYY-MM-DD)', example: '2026-10-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;

  @ApiPropertyOptional({ description: 'Reason for replacement', example: 'Role transition' })
  @IsString()
  @IsOptional()
  reason?: string;
}

