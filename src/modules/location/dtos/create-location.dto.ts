import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateLocationDto {
  @ApiPropertyOptional({ description: 'Location code', example: 'LOC-001' })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  code?: string;

  @ApiProperty({ description: 'Location name', example: 'Headquarters Building' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Location description', example: 'Main corporate office' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '2-letter country code', example: 'VN' })
  @IsString()
  @IsOptional()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ description: 'IANA timezone', example: 'Asia/Ho_Chi_Minh' })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Physical address structured object',
    example: { street: '123 Le Loi', city: 'HCMC' },
  })
  @IsObject()
  @IsOptional()
  address?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Whether this location is company headquarter',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isHeadquarter?: boolean;

  @ApiProperty({ description: 'Future effective start date (YYYY-MM-DD)', example: '2026-10-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}
