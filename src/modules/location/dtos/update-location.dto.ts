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

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  countryCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  timezone?: string;

  @IsObject()
  @IsOptional()
  address?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isHeadquarter?: boolean;

  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}
