import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { SetupStepStatus, SetupStepType } from '../../../enums';
import {
  CompanySetupProgressResponseDto,
  SetupStepDetailDto,
} from '../dto/company-setup-progress-response.dto';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';
import { CompanyRepository } from '../repositories/company.repository';

export interface SetupValidationResult {
  isEligible: boolean;
  totalSteps: number;
  completedSteps: number;
  incompleteSteps: SetupStepType[];
}

@Injectable()
export class CompanySetupQueryService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly companySetupStepRepository: CompanySetupStepRepository,
  ) {}

  async getCompanySetupProgress(companyId: string): Promise<CompanySetupProgressResponseDto> {
    const company = await this.companyRepository.findById(companyId, { required: true });
    const steps = await this.companySetupStepRepository.findByCompanyId(companyId);

    if (steps.length === 0) {
      throw new UnprocessableEntityException(
        `Setup tracking records not initialized for company '${companyId}'`,
      );
    }

    const stepDtos: SetupStepDetailDto[] = steps.map((step) => ({
      stepType: step.stepType,
      stepOrder: step.stepOrder,
      status: step.status,
      completedAt: step.completedAt ?? null,
      completedBy: step.completedBy ?? null,
      externalReferenceId: step.externalReferenceId ?? null,
      metadata: step.metadata ?? {},
    }));

    const completedSteps = stepDtos.filter((s) => s.status === SetupStepStatus.COMPLETED).length;
    const totalSteps = stepDtos.length;
    const incompleteSteps = stepDtos
      .filter((s) => s.status === SetupStepStatus.INCOMPLETE)
      .map((s) => s.stepType);
    const isEligibleForActivation = totalSteps === 8 && completedSteps === 8;

    return {
      companyId: company.id,
      status: company.status,
      totalSteps,
      completedSteps,
      isEligibleForActivation,
      incompleteSteps,
      steps: stepDtos,
    };
  }

  async validateAllStepsCompleted(companyId: string): Promise<SetupValidationResult> {
    const progress = await this.getCompanySetupProgress(companyId);
    return {
      isEligible: progress.isEligibleForActivation,
      totalSteps: progress.totalSteps,
      completedSteps: progress.completedSteps,
      incompleteSteps: progress.incompleteSteps,
    };
  }
}
