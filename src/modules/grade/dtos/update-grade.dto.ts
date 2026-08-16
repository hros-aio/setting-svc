import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateGradeDto {
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
  @IsInt()
  @IsOptional()
  rankOrder?: number | null;

  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}
