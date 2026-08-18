import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ReplacePocDto {
  @IsUUID('4')
  @IsNotEmpty()
  newEmployeeId: string;

  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
