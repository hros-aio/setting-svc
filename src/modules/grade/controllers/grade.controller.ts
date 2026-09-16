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
import { AuthGuard, PermissionGuard, RequirePermission } from '@new-hros/libs-apis';
import { RequestContextService } from '@new-hros/libs-core';
import { Grade, PaginatedResult } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { CreateGradeDto } from '../dtos/create-grade.dto';
import { DeactivateGradeDto, QueryGradeDto } from '../dtos/query-grade.dto';
import { UpdateGradeDto } from '../dtos/update-grade.dto';
import { GradeQueryService, GradeWithPendingChange } from '../services/grade-query.service';
import { GradeService } from '../services/grade.service';

@Controller('grades')
@UseGuards(AuthGuard, PermissionGuard)
export class GradeController {
  constructor(
    private readonly gradeService: GradeService,
    private readonly gradeQueryService: GradeQueryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('grade:create')
  async create(@Body() dto: CreateGradeDto): Promise<Grade> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.gradeService.create(dto, companyId);
  }

  @Get()
  @RequirePermission('grade:read')
  async findAll(@Query() query: QueryGradeDto): Promise<PaginatedResult<Grade>> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.gradeQueryService.find(companyId, query);
  }

  @Get(':id')
  @RequirePermission('grade:read')
  async findById(@Param('id') id: string): Promise<GradeWithPendingChange> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.gradeQueryService.findById(id, companyId);
  }

  @Patch(':id')
  @RequirePermission('grade:update')
  async updateGrade(
    @Param('id') id: string,
    @Body() dto: UpdateGradeDto,
  ): Promise<EffectiveChangeEntity> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.gradeService.scheduleUpdate(id, dto, companyId);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('grade:deactivate')
  async deactivateGrade(
    @Param('id') id: string,
    @Body() dto: DeactivateGradeDto,
  ): Promise<EffectiveChangeEntity> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.gradeService.scheduleDeactivation(id, dto, companyId);
  }
}
