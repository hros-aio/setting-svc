import { IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateCompanyInformationDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  legalName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  taxRegistrationNumber?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, {
    message: 'countryCode must be a valid 2-letter ISO country code (ISO-3166-1 alpha-2)',
  })
  countryCode?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currencyCode must be a valid 3-letter ISO currency code (ISO-4217)',
  })
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/, {
    message: 'timezone must be a valid IANA timezone identifier',
  })
  timezone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  locale?: string;

  @IsOptional()
  @IsObject()
  legalAddress?: Record<string, unknown>;
}
