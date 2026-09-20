import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { PocType } from '../../../enums';

export class CreatePocDto {
  @ApiProperty({
    description: 'Point of Contact type',
    enum: PocType,
    example: PocType.HR_HEAD,
  })
  @IsEnum(PocType, {
    message: `pocType must be one of: ${Object.values(PocType).join(', ')}`,
  })
  @IsNotEmpty()
  pocType: PocType;

  @ApiProperty({ description: 'Employee UUID', example: 'emp-123' })
  @IsUUID('4')
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ description: 'Future effective start date (YYYY-MM-DD)', example: '2026-10-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}

