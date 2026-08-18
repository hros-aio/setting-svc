import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser, PermissionGuard, RequirePermission } from '@new-hros/libs-apis';
import { AuthContext } from '@new-hros/libs-core';
import { CompanyScopeGuard, TenantScopeGuard } from '../../../common/guards';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { CreateGradeDto } from '../dtos/create-grade.dto';
import { DeactivateGradeDto, QueryGradeDto } from '../dtos/query-grade.dto';
import { UpdateGradeDto } from '../dtos/update-grade.dto';
import { GradeEntity } from '../entities/grade.entity';
import { PaginatedResult } from '../repositories/grade.repository.interface';
import { GradeQueryService, GradeWithPendingChange } from '../services/grade-query.service';
import { GradeService } from '../services/grade.service';

@Controller('grades')
@UseGuards(AuthGuard, PermissionGuard, TenantScopeGuard, CompanyScopeGuard)
export class GradeController {
  constructor(
    private readonly gradeService: GradeService,
    private readonly gradeQueryService: GradeQueryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('grade:create')
  async create(
    @Body() dto: CreateGradeDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<GradeEntity> {
    return this.gradeService.create(dto, authContext);
  }

  @Get()
  @RequirePermission('grade:read')
  async findAll(
    @Query() query: QueryGradeDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<PaginatedResult<GradeEntity>> {
    return this.gradeQueryService.find(query, authContext);
  }

  @Get(':id')
  @RequirePermission('grade:read')
  async findById(
    @Param('id') id: string,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<GradeWithPendingChange> {
    return this.gradeQueryService.findById(id, authContext);
  }

  @Patch(':id')
  @RequirePermission('grade:update')
  async updateGrade(
    @Param('id') id: string,
    @Body() dto: UpdateGradeDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<EffectiveChangeEntity> {
    return this.gradeService.scheduleUpdate(id, dto, authContext);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('grade:deactivate')
  async deactivateGrade(
    @Param('id') id: string,
    @Body() dto: DeactivateGradeDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<EffectiveChangeEntity> {
    return this.gradeService.scheduleDeactivation(id, dto, authContext);
  }
}
