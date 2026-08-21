import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { EffectiveChangeStatus } from '../../../enums';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { QueryJobTitleDto } from '../dtos/query-job-title.dto';
import { JobTitle } from '@new-hros/libs-sql';
import { JobTitleRepository } from '../repositories/job-title.repository';
import { JobTitlePaginatedResult } from '../repositories/job-title.repository.interface';

export interface JobTitleWithPendingChange extends JobTitle {
  pendingChange?: {
    changeId: string;
    action: string;
    status: EffectiveChangeStatus;
    effectiveAt: Date;
    payload: Record<string, unknown>;
  } | null;
}

@Injectable()
export class JobTitleQueryService {
  private readonly logger = new Logger(JobTitleQueryService.name);

  constructor(
    private readonly jobTitleRepository: JobTitleRepository,
    private readonly effectiveChangeRepository: EffectiveChangeRepository,
  ) {}

  async find(
    query?: QueryJobTitleDto,
    authContext?: AuthContext | null,
  ): Promise<JobTitlePaginatedResult<JobTitle>> {
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);

    const page = query?.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query?.limit && query.limit > 0 ? Math.min(Number(query.limit), 100) : 20;

    return this.jobTitleRepository.find(tenantId, companyId, {
      page,
      limit,
      search: query?.search,
      status: query?.status,
      departmentId: query?.departmentId,
      gradeId: query?.gradeId,
    });
  }

  async findById(id: string, authContext?: AuthContext | null): Promise<JobTitleWithPendingChange> {
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);

    const jobTitle = await this.jobTitleRepository.findById(tenantId, companyId, id);
    if (!jobTitle) {
      throw new NotFoundException(`Job Title with ID '${id}' not found`);
    }

    const pendingChange = await this.effectiveChangeRepository.findPendingChange(
      companyId,
      'job_title',
      id,
    );

    const result: JobTitleWithPendingChange = {
      ...jobTitle,
      pendingChange: pendingChange
        ? {
            changeId: pendingChange.id,
            action: (pendingChange.operation || '').toUpperCase(),
            status: pendingChange.status,
            effectiveAt: pendingChange.effectiveAt,
            payload: pendingChange.payload || {},
          }
        : null,
    };

    return result;
  }

  private resolveTenantAndCompany(authContext?: AuthContext | null): {
    tenantId: string;
    companyId: string;
  } {
    const tenantId = authContext?.tenantCode || RequestContextService.getTenantCode();
    const companyId = RequestContextService.current()?.companyId;

    if (!tenantId) {
      throw new BadRequestException('Cannot determine tenant from request context');
    }
    if (!companyId) {
      throw new BadRequestException('Cannot determine company from request context');
    }

    return { tenantId, companyId };
  }
}
