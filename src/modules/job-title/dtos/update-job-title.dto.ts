import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateJobTitleDto {
  @IsString()
  @IsOptional()
  @MaxLength(64)
  code?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsUUID('4')
  @IsOptional()
  departmentId?: string;

  @IsUUID('4')
  @IsOptional()
  gradeId?: string;

  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString()
  @IsOptional()
  description?: string | null;

  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}
