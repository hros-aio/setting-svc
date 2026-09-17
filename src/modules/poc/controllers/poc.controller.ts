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
import { AuthGuard, PermissionGuard, RequirePermission } from '@new-hros/libs-apis';
import { PaginatedResult } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { CreatePocDto } from '../dtos/create-poc.dto';
import { DeactivatePocDto } from '../dtos/deactivate-poc.dto';
import { QueryPocDto } from '../dtos/query-poc.dto';
import { ReplacePocDto } from '../dtos/replace-poc.dto';
import { PocEntity } from '../entities/poc.entity';
import {
  ActivePocResponse,
  PocHistoryItemResponse,
  PocQueryService,
} from '../services/poc-query.service';
import { PocService } from '../services/poc.service';

@Controller('companies/:companyId/pocs')
@UseGuards(AuthGuard, PermissionGuard)
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
  ): Promise<PocEntity> {
    return this.pocService.create(companyId, dto);
  }

  @Put(':pocId/replace')
  @RequirePermission('poc:update')
  async replace(
    @Param('companyId') companyId: string,
    @Param('pocId') pocId: string,
    @Body() dto: ReplacePocDto,
  ): Promise<EffectiveChangeEntity> {
    return this.pocService.replace(companyId, pocId, dto);
  }

  @Delete(':pocId')
  @RequirePermission('poc:deactivate')
  async deactivate(
    @Param('companyId') companyId: string,
    @Param('pocId') pocId: string,
    @Body() dto: DeactivatePocDto,
  ): Promise<EffectiveChangeEntity> {
    return this.pocService.deactivate(companyId, pocId, dto);
  }

  @Get()
  @RequirePermission('poc:read')
  async findActive(@Param('companyId') companyId: string): Promise<ActivePocResponse[]> {
    return this.pocQueryService.findActiveByCompany(companyId);
  }

  @Get('history')
  @RequirePermission('poc:read')
  async findHistory(
    @Param('companyId') companyId: string,
    @Query() query: QueryPocDto,
  ): Promise<PaginatedResult<PocHistoryItemResponse>> {
    return this.pocQueryService.findHistoryByCompany(companyId, query);
  }
}
