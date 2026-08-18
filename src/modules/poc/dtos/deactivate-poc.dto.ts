import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeactivatePocDto {
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
