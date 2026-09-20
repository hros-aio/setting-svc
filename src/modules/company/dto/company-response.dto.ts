import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyStatus, SetupStepStatus, SetupStepType } from '../../../enums';
import { CompanyEntity } from '../entities/company.entity';

export class SetupStepResponseDto {
  @ApiProperty({ enum: SetupStepType, example: SetupStepType.LOCATION })
  stepType: SetupStepType;

  @ApiProperty({ example: 1 })
  stepOrder: number;

  @ApiProperty({ enum: SetupStepStatus, example: SetupStepStatus.COMPLETED })
  status: SetupStepStatus;

  @ApiPropertyOptional({ example: '2026-09-20T04:00:00.000Z' })
  completedAt?: Date;

  @ApiPropertyOptional({ example: 'usr-123' })
  completedBy?: string;

  @ApiPropertyOptional({ example: 'ref-456' })
  externalReferenceId?: string;

  @ApiPropertyOptional({ example: { source: 'seed' } })
  metadata?: Record<string, unknown>;
}

export class CompanyResponseDto {
  @ApiProperty({ example: 'comp-123' })
  id: string;

  @ApiProperty({ example: 'TENANT_DEFAULT' })
  tenantCode: string;

  @ApiProperty({ example: 'COMP_001' })
  companyCode: string;

  @ApiProperty({ example: 'Acme Corporation' })
  legalName: string;

  @ApiPropertyOptional({ example: 'Acme' })
  displayName?: string;

  @ApiProperty({ enum: CompanyStatus, example: CompanyStatus.PENDING })
  status: CompanyStatus;

  @ApiProperty({ example: false })
  isTemplate: boolean;

  @ApiPropertyOptional({ example: 'BR-12345678' })
  registrationNumber?: string;

  @ApiPropertyOptional({ example: 'TAX-987654321' })
  taxRegistrationNumber?: string;

  @ApiPropertyOptional({ example: 'VN' })
  countryCode?: string;

  @ApiPropertyOptional({ example: 'VND' })
  currencyCode?: string;

  @ApiProperty({ example: 'Asia/Ho_Chi_Minh' })
  timezone: string;

  @ApiPropertyOptional({ example: 'vi_VN' })
  locale?: string;

  @ApiPropertyOptional({ example: { street: '123 Main St' } })
  legalAddress?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '2026-09-20T04:00:00.000Z' })
  informationCompletedAt?: Date;

  @ApiPropertyOptional({ example: 'usr-123' })
  informationCompletedBy?: string;

  @ApiPropertyOptional({ example: '2026-09-20T04:00:00.000Z' })
  activatedAt?: Date;

  @ApiPropertyOptional({ example: 'usr-123' })
  activatedBy?: string;

  @ApiProperty({ example: '2026-09-20T04:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-20T04:00:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: [SetupStepResponseDto] })
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
