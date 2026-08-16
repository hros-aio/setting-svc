import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SetupStepStatus, SetupStepType } from '../../../enums';

export class SetupStepDetailDto {
  @ApiProperty({ enum: SetupStepType, description: 'Step type enumeration' })
  stepType: SetupStepType;

  @ApiProperty({ description: 'Step order sequence (1 to 8)', example: 1 })
  stepOrder: number;

  @ApiProperty({ enum: SetupStepStatus, description: 'Step completion status' })
  status: SetupStepStatus;

  @ApiPropertyOptional({ description: 'Timestamp when step was completed', nullable: true })
  completedAt?: Date | null;

  @ApiPropertyOptional({ description: 'User ID who completed the step', nullable: true })
  completedBy?: string | null;

  @ApiPropertyOptional({
    description: 'External batch or reference ID (for roles and employee import)',
    nullable: true,
  })
  externalReferenceId?: string | null;

  @ApiPropertyOptional({ description: 'Metadata for completion tracking', type: Object })
  metadata?: Record<string, unknown>;
}

export class CompanySetupProgressResponseDto {
  @ApiProperty({ description: 'Target Company UUID' })
  companyId: string;

  @ApiProperty({ description: 'Target Company status', example: 'pending' })
  status: string;

  @ApiProperty({ description: 'Total number of mandatory setup steps', example: 8 })
  totalSteps: number;

  @ApiProperty({ description: 'Number of completed setup steps', example: 3 })
  completedSteps: number;

  @ApiProperty({
    description: 'Whether company satisfies all mandatory steps for activation',
    example: false,
  })
  isEligibleForActivation: boolean;

  @ApiProperty({
    description: 'List of remaining incomplete step types',
    enum: SetupStepType,
    isArray: true,
  })
  incompleteSteps: SetupStepType[];

  @ApiProperty({
    description: 'Ordered list of all 8 setup steps and their completion details',
    type: [SetupStepDetailDto],
  })
  steps: SetupStepDetailDto[];
}
