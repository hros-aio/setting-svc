import { IsDateString, IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { PocType } from '../../../enums';

export class CreatePocDto {
  @IsEnum(PocType, {
    message: `pocType must be one of: ${Object.values(PocType).join(', ')}`,
  })
  @IsNotEmpty()
  pocType: PocType;

  @IsUUID('4')
  @IsNotEmpty()
  employeeId: string;

  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}
