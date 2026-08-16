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
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { CreateJobTitleDto } from '../dtos/create-job-title.dto';
import { DeactivateJobTitleDto, QueryJobTitleDto } from '../dtos/query-job-title.dto';
import { UpdateJobTitleDto } from '../dtos/update-job-title.dto';
import { JobTitleEntity } from '../entities/job-title.entity';
import { JobTitlePaginatedResult } from '../repositories/job-title.repository.interface';
import {
  JobTitleQueryService,
  JobTitleWithPendingChange,
} from '../services/job-title-query.service';
import { JobTitleService } from '../services/job-title.service';

@Controller('job-titles')
@UseGuards(AuthGuard, PermissionGuard)
export class JobTitleController {
  constructor(
    private readonly jobTitleService: JobTitleService,
    private readonly jobTitleQueryService: JobTitleQueryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('job-title:create')
  async create(
    @Body() dto: CreateJobTitleDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<JobTitleEntity> {
    return this.jobTitleService.create(dto, authContext);
  }

  @Get()
  @RequirePermission('job-title:read')
  async findAll(
    @Query() query: QueryJobTitleDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<JobTitlePaginatedResult<JobTitleEntity>> {
    return this.jobTitleQueryService.find(query, authContext);
  }

  @Get(':id')
  @RequirePermission('job-title:read')
  async findById(
    @Param('id') id: string,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<JobTitleWithPendingChange> {
    return this.jobTitleQueryService.findById(id, authContext);
  }

  @Patch(':id')
  @RequirePermission('job-title:update')
  async updateJobTitle(
    @Param('id') id: string,
    @Body() dto: UpdateJobTitleDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<EffectiveChangeEntity> {
    return this.jobTitleService.scheduleUpdate(id, dto, authContext);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('job-title:deactivate')
  async deactivateJobTitle(
    @Param('id') id: string,
    @Body() dto: DeactivateJobTitleDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<EffectiveChangeEntity> {
    return this.jobTitleService.scheduleDeactivation(id, dto, authContext);
  }
}
