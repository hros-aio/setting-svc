import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Optional,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard, PermissionGuard, RequirePermission } from '@new-hros/libs-apis';
import { CacheService, RequestContextService } from '@new-hros/libs-core';
import { TenantRepository } from '../../tenant/repositories/tenant.repository';
import { CompanyResponseDto, SetupStepResponseDto } from '../dto/company-response.dto';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { CompanyService } from '../services/company.service';

@Controller('companies')
@UseGuards(AuthGuard, PermissionGuard)
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly tenantRepository: TenantRepository,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('company:create')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createCompany(
    @Body() dto: CreateCompanyDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<{ success: boolean; data: CompanyResponseDto }> {
    const tenantCode = RequestContextService.getTenantCode();
    const user = RequestContextService.getUser();

    if (!tenantCode) {
      throw new BadRequestException('Cannot determine tenant from request context');
    }

    const tenant = await this.tenantRepository.findByTenantCode(tenantCode);
    if (!tenant) {
      throw new BadRequestException(`Tenant not found for tenantCode: ${tenantCode}`);
    }

    // Check cached response if idempotency key was supplied
    const cacheKey = idempotencyKey
      ? `idempotency:company-create:${tenant.id}:${idempotencyKey}`
      : null;

    if (cacheKey && this.cacheService) {
      const cachedResponse = await this.cacheService.get<{
        success: boolean;
        data: CompanyResponseDto;
      }>(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const userId = user?.userId;
    const company = await this.companyService.createCompany(tenant.id, dto, userId);

    const setupStepsDto: SetupStepResponseDto[] = (company.setupSteps || []).map((step) => ({
      stepType: step.stepType,
      stepOrder: step.stepOrder,
      status: step.status,
      completedAt: step.completedAt,
      completedBy: step.completedBy,
      externalReferenceId: step.externalReferenceId,
      metadata: step.metadata,
    }));

    const responseDto: CompanyResponseDto = {
      id: company.id,
      tenantId: company.tenantId,
      companyCode: company.companyCode,
      legalName: company.legalName,
      displayName: company.displayName,
      status: company.status,
      isTemplate: company.isTemplate,
      registrationNumber: company.registrationNumber,
      taxRegistrationNumber: company.taxRegistrationNumber,
      countryCode: company.countryCode,
      currencyCode: company.currencyCode,
      timezone: company.timezone,
      locale: company.locale,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      setupSteps: setupStepsDto,
    };

    const response = {
      success: true,
      data: responseDto,
    };

    if (cacheKey && this.cacheService) {
      // Cache response with a 24-hour TTL for network retries
      await this.cacheService.set(cacheKey, response, 86400);
    }

    return response;
  }
}
