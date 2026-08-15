import { CompanyStatus, SetupStepStatus, SetupStepType } from '../../../enums';

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
  tenantId: string;
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
  createdAt: Date;
  updatedAt: Date;
  setupSteps?: SetupStepResponseDto[];
}
