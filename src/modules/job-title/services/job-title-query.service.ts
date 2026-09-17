import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { JobTitle, PaginatedResult } from '@new-hros/libs-sql';
import { EffectiveChangeStatus } from '../../../enums';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { QueryJobTitleDto } from '../dtos/query-job-title.dto';
import { JobTitleRepository } from '../repositories/job-title.repository';

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

  async find(companyId: string, query?: QueryJobTitleDto): Promise<PaginatedResult<JobTitle>> {
    const page = query?.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query?.limit && query.limit > 0 ? Math.min(Number(query.limit), 100) : 20;

    return this.jobTitleRepository.findJobTitles(
      companyId,
      { page, limit },
      query?.search,
      query?.status,
      query?.departmentId,
      query?.gradeId,
    );
  }

  async findById(id: string, companyId?: string): Promise<JobTitleWithPendingChange> {
    const jobTitle = await this.jobTitleRepository.findByIdWithRelations(id);
    if (!jobTitle) {
      throw new NotFoundException(`Job Title with ID '${id}' not found`);
    }

    const targetCompanyId =
      companyId || RequestContextService.current()?.companyId || jobTitle.companyId;

    const pendingChange = await this.effectiveChangeRepository.findPendingChange(
      targetCompanyId,
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
}
