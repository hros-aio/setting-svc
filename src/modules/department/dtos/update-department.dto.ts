import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateDepartmentDto {
  @IsString()
  @IsOptional()
  @MaxLength(64)
  code?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsUUID()
  @IsOptional()
  parentDepartmentId?: string | null;

  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}
