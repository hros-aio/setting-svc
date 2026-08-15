import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { CopyableCategory } from '../enums/copyable-category.enum';

export class CreateCompanyDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,64}$/, {
    message:
      'companyCode must be between 2 and 64 characters long and contain only uppercase alphanumeric characters, underscores, and hyphens',
  })
  companyCode: string;

  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  name: string;

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

  @IsNotEmpty()
  @IsString()
  @Length(2, 2)
  countryCode: string;

  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  currencyCode: string;

  @IsNotEmpty()
  @IsString()
  @Length(1, 64)
  timezone: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  locale?: string;

  @IsOptional()
  @IsBoolean()
  copyFromDefault?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(CopyableCategory, { each: true })
  copyCategories?: CopyableCategory[];
}
