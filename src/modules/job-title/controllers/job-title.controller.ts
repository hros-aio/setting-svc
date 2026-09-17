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
import { JobTitle, PaginatedResult } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { CreateJobTitleDto } from '../dtos/create-job-title.dto';
import { DeactivateJobTitleDto, QueryJobTitleDto } from '../dtos/query-job-title.dto';
import { UpdateJobTitleDto } from '../dtos/update-job-title.dto';
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
  async create(@Body() dto: CreateJobTitleDto): Promise<JobTitle> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.jobTitleService.create(dto, companyId);
  }

  @Get()
  @RequirePermission('job-title:read')
  async findAll(@Query() query: QueryJobTitleDto): Promise<PaginatedResult<JobTitle>> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.jobTitleQueryService.find(companyId, query);
  }

  @Get(':id')
  @RequirePermission('job-title:read')
  async findById(@Param('id') id: string): Promise<JobTitleWithPendingChange> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.jobTitleQueryService.findById(id, companyId);
  }

  @Patch(':id')
  @RequirePermission('job-title:update')
  async updateJobTitle(
    @Param('id') id: string,
    @Body() dto: UpdateJobTitleDto,
  ): Promise<EffectiveChangeEntity> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.jobTitleService.scheduleUpdate(id, dto, companyId);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('job-title:deactivate')
  async deactivateJobTitle(
    @Param('id') id: string,
    @Body() dto: DeactivateJobTitleDto,
  ): Promise<EffectiveChangeEntity> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.jobTitleService.scheduleDeactivation(id, dto, companyId);
  }
}
