import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateJobTitleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsUUID('4')
  @IsNotEmpty()
  departmentId: string;

  @IsUUID('4')
  @IsNotEmpty()
  gradeId: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}
