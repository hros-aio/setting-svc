import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Unique company code across tenant',
    example: 'COMP_001',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,64}$/, {
    message:
      'companyCode must be between 2 and 64 characters long and contain only uppercase alphanumeric characters, underscores, and hyphens',
  })
  companyCode: string;

  @ApiProperty({
    description: 'Company operational name',
    example: 'Acme Corporation',
  })
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  name: string;

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

  @ApiProperty({
    description: 'ISO-2 country code',
    example: 'VN',
  })
  @IsNotEmpty()
  @IsString()
  @Length(2, 2)
  countryCode: string;

  @ApiProperty({
    description: 'ISO-3 currency code',
    example: 'VND',
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  currencyCode: string;

  @ApiProperty({
    description: 'IANA timezone identifier',
    example: 'Asia/Ho_Chi_Minh',
  })
  @IsNotEmpty()
  @IsString()
  @Length(1, 64)
  timezone: string;

  @ApiPropertyOptional({
    description: 'Preferred locale code',
    example: 'vi_VN',
  })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  locale?: string;

  @ApiPropertyOptional({
    description: 'Whether to copy configuration from Default Company',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  copyFromDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Categories to copy when copyFromDefault is true',
    enum: CopyableCategory,
    isArray: true,
    example: [CopyableCategory.GRADES, CopyableCategory.JOB_TITLES],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(CopyableCategory, { each: true })
  copyCategories?: CopyableCategory[];
}
