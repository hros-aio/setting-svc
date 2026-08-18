import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser, PermissionGuard, RequirePermission } from '@new-hros/libs-apis';
import { AuthContext } from '@new-hros/libs-core';
import { CompanyScopeGuard, TenantScopeGuard } from '../../../common/guards';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { CreatePocDto } from '../dtos/create-poc.dto';
import { DeactivatePocDto } from '../dtos/deactivate-poc.dto';
import { QueryPocDto } from '../dtos/query-poc.dto';
import { ReplacePocDto } from '../dtos/replace-poc.dto';
import { PocEntity } from '../entities/poc.entity';
import { PocPaginatedResult } from '../repositories/poc.repository.interface';
import {
  ActivePocResponse,
  PocHistoryItemResponse,
  PocQueryService,
} from '../services/poc-query.service';
import { PocService } from '../services/poc.service';

@Controller('companies/:companyId/pocs')
@UseGuards(AuthGuard, PermissionGuard, TenantScopeGuard, CompanyScopeGuard)
export class PocController {
  constructor(
    private readonly pocService: PocService,
    private readonly pocQueryService: PocQueryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('poc:create')
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreatePocDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<PocEntity> {
    return this.pocService.create(companyId, dto, authContext);
  }

  @Put(':pocId/replace')
  @RequirePermission('poc:update')
  async replace(
    @Param('companyId') companyId: string,
    @Param('pocId') pocId: string,
    @Body() dto: ReplacePocDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<EffectiveChangeEntity> {
    return this.pocService.replace(companyId, pocId, dto, authContext);
  }

  @Delete(':pocId')
  @RequirePermission('poc:deactivate')
  async deactivate(
    @Param('companyId') companyId: string,
    @Param('pocId') pocId: string,
    @Body() dto: DeactivatePocDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<EffectiveChangeEntity> {
    return this.pocService.deactivate(companyId, pocId, dto, authContext);
  }

  @Get()
  @RequirePermission('poc:read')
  async findActive(
    @Param('companyId') companyId: string,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<ActivePocResponse[]> {
    return this.pocQueryService.findActiveByCompany(companyId, authContext);
  }

  @Get('history')
  @RequirePermission('poc:read')
  async findHistory(
    @Param('companyId') companyId: string,
    @Query() query: QueryPocDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<PocPaginatedResult<PocHistoryItemResponse>> {
    return this.pocQueryService.findHistoryByCompany(companyId, query, authContext);
  }
}
