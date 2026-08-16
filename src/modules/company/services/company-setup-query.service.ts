import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { SetupStepStatus, SetupStepType } from '../../../enums';
import { TenantRepository } from '../../tenant/repositories/tenant.repository';
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
    private readonly tenantRepository: TenantRepository,
  ) {}

  private async resolveTenantId(tenantCodeOrId: string): Promise<string> {
    if (isUUID(tenantCodeOrId)) {
      return tenantCodeOrId;
    }
    const tenant = await this.tenantRepository.findByTenantCode(tenantCodeOrId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found for tenantCode: ${tenantCodeOrId}`);
    }
    return tenant.id;
  }

  async getCompanySetupProgress(
    tenantCodeOrId: string,
    companyId: string,
  ): Promise<CompanySetupProgressResponseDto> {
    const tenantId = await this.resolveTenantId(tenantCodeOrId);

    const company = await this.companyRepository.findByIdAndTenant(companyId, tenantId);
    if (!company) {
      throw new NotFoundException(`Company with ID '${companyId}' not found for this tenant`);
    }

    const steps = await this.companySetupStepRepository.findStepsByCompanyId(companyId);

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

  async validateAllStepsCompleted(
    tenantCodeOrId: string,
    companyId: string,
  ): Promise<SetupValidationResult> {
    const progress = await this.getCompanySetupProgress(tenantCodeOrId, companyId);
    return {
      isEligible: progress.isEligibleForActivation,
      totalSteps: progress.totalSteps,
      completedSteps: progress.completedSteps,
      incompleteSteps: progress.incompleteSteps,
    };
  }
}
