import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateCompanyInformationDto {
  @ApiPropertyOptional({
    description: 'Company operational name',
    example: 'Acme Corporation Updated',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Company legal entity name',
    example: 'Acme Global Holdings Ltd.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  legalName?: string;

  @ApiPropertyOptional({
    description: 'Display name used in UI',
    example: 'Acme',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Business registration number',
    example: 'BR-12345678',
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  registrationNumber?: string;

  @ApiPropertyOptional({
    description: 'Tax registration number',
    example: 'TAX-987654321',
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  taxRegistrationNumber?: string;

  @ApiPropertyOptional({
    description: 'ISO-2 country code',
    example: 'VN',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, {
    message: 'countryCode must be a valid 2-letter ISO country code (ISO-3166-1 alpha-2)',
  })
  countryCode?: string;

  @ApiPropertyOptional({
    description: 'ISO-3 currency code',
    example: 'VND',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currencyCode must be a valid 3-letter ISO currency code (ISO-4217)',
  })
  currencyCode?: string;

  @ApiPropertyOptional({
    description: 'IANA timezone identifier',
    example: 'Asia/Ho_Chi_Minh',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/, {
    message: 'timezone must be a valid IANA timezone identifier',
  })
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Preferred locale code',
    example: 'vi_VN',
  })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  locale?: string;

  @ApiPropertyOptional({
    description: 'Legal registered address JSON object',
    example: { street: '123 Main St', city: 'Ho Chi Minh' },
  })
  @IsOptional()
  @IsObject()
  legalAddress?: Record<string, unknown>;
}
