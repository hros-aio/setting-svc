import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard, PermissionGuard, RequirePermission } from '@new-hros/libs-apis';
import { CacheService, RequestContextService } from '@new-hros/libs-core';
import { buildIdempotencyKey } from '../../../common/utils';
import { CompanyResponseDto } from '../dto/company-response.dto';
import { CompanySetupProgressResponseDto } from '../dto/company-setup-progress-response.dto';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyInformationDto } from '../dto/update-company-information.dto';
import { CompanySetupQueryService } from '../services/company-setup-query.service';
import { CompanyService } from '../services/company.service';

@Controller('companies')
@UseGuards(AuthGuard, PermissionGuard)
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly companySetupQueryService: CompanySetupQueryService,
    private readonly cacheService: CacheService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('company:create')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createCompany(
    @Body() dto: CreateCompanyDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CompanyResponseDto> {
    const tenantCode = RequestContextService.getTenantCode();
    if (!tenantCode) {
      throw new BadRequestException('Cannot determine tenant from request context');
    }

    // Check cached response if idempotency key was supplied using unified key generator
    const cacheKey = buildIdempotencyKey(tenantCode, idempotencyKey, 'company');
    if (cacheKey) {
      const { result } = await this.cacheService.executeIfAbsent(
        cacheKey,
        async () => {
          const company = await this.companyService.createCompany(dto);
          return CompanyResponseDto.fromCompany(company);
        },
        86400,
      );
      return result!;
    }

    const company = await this.companyService.createCompany(dto);
    return CompanyResponseDto.fromCompany(company);
  }

  @Patch(':id/information')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('company:update')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateCompanyInformation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCompanyInformationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CompanyResponseDto> {
    const tenantCode = RequestContextService.getTenantCode();
    if (!tenantCode) {
      throw new BadRequestException('Cannot determine tenant from request context');
    }

    // Check cached response if idempotency key was supplied using unified key generator
    const cacheKey = buildIdempotencyKey(tenantCode, idempotencyKey, 'company');
    if (cacheKey) {
      const { result } = await this.cacheService.executeIfAbsent(
        cacheKey,
        async () => {
          const company = await this.companyService.updateCompanyInformation(id, dto);
          return CompanyResponseDto.fromCompany(company);
        },
        86400,
      );
      return result!;
    }

    const company = await this.companyService.updateCompanyInformation(id, dto);
    return CompanyResponseDto.fromCompany(company);
  }

  @Get(':id/setup')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('company:read')
  async getCompanySetupProgress(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CompanySetupProgressResponseDto> {
    return this.companySetupQueryService.getCompanySetupProgress(id);
  }

  @Put(':id/default')
  @Patch(':id/default')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('company:update')
  async designateDefaultCompany(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CompanyResponseDto> {
    const company = await this.companyService.designateDefaultCompany(id);
    return CompanyResponseDto.fromCompany(company);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('company:activate')
  async activateCompany(@Param('id', new ParseUUIDPipe()) id: string): Promise<CompanyResponseDto> {
    const company = await this.companyService.activateCompany(id);
    return CompanyResponseDto.fromCompany(company);
  }
}
