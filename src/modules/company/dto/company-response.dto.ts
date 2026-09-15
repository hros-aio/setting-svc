import { CompanyStatus, SetupStepStatus, SetupStepType } from '../../../enums';
import { CompanyEntity } from '../entities/company.entity';

export class SetupStepResponseDto {
  stepType: SetupStepType;
  stepOrder: number;
  status: SetupStepStatus;
  completedAt?: Date;
  completedBy?: string;
  externalReferenceId?: string;
  metadata?: Record<string, unknown>;
}

export class CompanyResponseDto {
  id: string;
  tenantCode: string;
  companyCode: string;
  legalName: string;
  displayName?: string;
  status: CompanyStatus;
  isTemplate: boolean;
  registrationNumber?: string;
  taxRegistrationNumber?: string;
  countryCode?: string;
  currencyCode?: string;
  timezone: string;
  locale?: string;
  legalAddress?: Record<string, unknown>;
  informationCompletedAt?: Date;
  informationCompletedBy?: string;
  activatedAt?: Date;
  activatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  setupSteps?: SetupStepResponseDto[];

  static fromCompany(company: CompanyEntity): CompanyResponseDto {
    const setupStepsDto: SetupStepResponseDto[] = (company.setupSteps || []).map((step) => ({
      stepType: step.stepType,
      stepOrder: step.stepOrder,
      status: step.status,
      completedAt: step.completedAt,
      completedBy: step.completedBy,
      externalReferenceId: step.externalReferenceId,
      metadata: step.metadata,
    }));

    return {
      id: company.id,
      tenantCode: company.tenantCode!,
      companyCode: company.companyCode,
      legalName: company.legalName,
      displayName: company.displayName ?? undefined,
      status: company.status,
      isTemplate: company.isTemplate,
      registrationNumber: company.registrationNumber ?? undefined,
      taxRegistrationNumber: company.taxRegistrationNumber ?? undefined,
      countryCode: company.countryCode ?? undefined,
      currencyCode: company.currencyCode ?? undefined,
      timezone: company.timezone,
      locale: company.locale ?? undefined,
      legalAddress: company.legalAddress ?? undefined,
      informationCompletedAt: company.informationCompletedAt ?? undefined,
      informationCompletedBy: company.informationCompletedBy ?? undefined,
      activatedAt: company.activatedAt ?? undefined,
      activatedBy: company.activatedBy ?? undefined,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      setupSteps: setupStepsDto,
    };
  }
}
