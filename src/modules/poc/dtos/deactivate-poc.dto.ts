import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeactivatePocDto {
  @ApiProperty({
    description: 'Future effective deactivation date (YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;

  @ApiPropertyOptional({ description: 'Reason for deactivation', example: 'Contract ended' })
  @IsString()
  @IsOptional()
  reason?: string;
}
