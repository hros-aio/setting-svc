import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { SetupStepType } from '../../../enums';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';

export interface MarkStepCompleteParams {
  tenantId: string;
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

  async markStepComplete(
    params: MarkStepCompleteParams,
    entityManager?: EntityManager,
  ): Promise<CompanySetupStepEntity> {
    const step = await this.setupStepRepository.markStepCompleted({
      ...params,
      entityManager: entityManager || (params.metadata?.entityManager as EntityManager | undefined),
    });

    if (!step) {
      throw new NotFoundException(
        `Setup step '${params.stepType}' for company '${params.companyId}' not found in tenant '${params.tenantId}'`,
      );
    }

    this.logger.log(
      `Marked setup step ${params.stepType} as COMPLETED for company ${params.companyId} (tenant: ${params.tenantId})`,
    );

    return step;
  }
}
