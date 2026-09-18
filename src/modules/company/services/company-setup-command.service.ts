import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SetupStepType } from '../../../enums';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';

export interface MarkStepCompleteParams {
  companyId: string;
  stepType: SetupStepType;
  completedBy?: string;
  metadata?: Record<string, unknown>;
  externalReferenceId?: string;
}

@Injectable()
export class CompanySetupCommandService {
  private readonly logger = new Logger(CompanySetupCommandService.name);

  constructor(private readonly setupStepRepository: CompanySetupStepRepository) {}

  async markStepComplete(params: MarkStepCompleteParams): Promise<CompanySetupStepEntity> {
    const step = await this.setupStepRepository.markStepCompleted({
      companyId: params.companyId,
      stepType: params.stepType,
      completedBy: params.completedBy,
      metadata: params.metadata,
      externalReferenceId: params.externalReferenceId,
    });

    if (!step) {
      throw new NotFoundException(
        `Setup step '${params.stepType}' for company '${params.companyId}' not found`,
      );
    }

    this.logger.log(
      `Marked setup step ${params.stepType} as COMPLETED for company ${params.companyId}`,
    );

    return step;
  }
}
