import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard, PermissionGuard, RequirePermission } from '@new-hros/libs-apis';
import { CacheService, RequestContextService } from '@new-hros/libs-core';
import { buildIdempotencyKey } from '../../../common/utils';
import { CompanyResponseDto, SetupStepResponseDto } from '../dto/company-response.dto';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyInformationDto } from '../dto/update-company-information.dto';
import { CompanyEntity } from '../entities/company.entity';
import { CompanyService } from '../services/company.service';

@Controller('companies')
@UseGuards(AuthGuard, PermissionGuard)
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
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

    // Check cached response if idempotency key was supplied using unified key generator
    const cacheKey = buildIdempotencyKey(tenantCode, idempotencyKey, 'company');

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
    const company = await this.companyService.createCompany(tenantCode, dto, userId);

    const responseDto = this.mapToCompanyResponseDto(company);

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

  @Patch(':id/information')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('company:update')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateCompanyInformation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCompanyInformationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<{ success: boolean; data: CompanyResponseDto }> {
    const tenantCode = RequestContextService.getTenantCode();
    const user = RequestContextService.getUser();

    if (!tenantCode) {
      throw new BadRequestException('Cannot determine tenant from request context');
    }

    // Check cached response if idempotency key was supplied using unified key generator
    const cacheKey = buildIdempotencyKey(tenantCode, idempotencyKey, 'company');

    if (cacheKey && this.cacheService) {
      const cachedResponse = await this.cacheService.get<{
        success: boolean;
        data: CompanyResponseDto;
      }>(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const company = await this.companyService.updateCompanyInformation(tenantCode, id, dto, user);

    const responseDto = this.mapToCompanyResponseDto(company);

    const response = {
      success: true,
      data: responseDto,
    };

    if (cacheKey && this.cacheService) {
      await this.cacheService.set(cacheKey, response, 86400);
    }

    return response;
  }

  private mapToCompanyResponseDto(company: CompanyEntity): CompanyResponseDto {
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
      legalAddress: company.legalAddress,
      informationCompletedAt: company.informationCompletedAt,
      informationCompletedBy: company.informationCompletedBy,
      activatedAt: company.activatedAt,
      activatedBy: company.activatedBy,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      setupSteps: setupStepsDto,
    };
  }
}
