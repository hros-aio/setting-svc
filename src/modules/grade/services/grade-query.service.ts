import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { EffectiveChangeStatus } from '../../../enums';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { QueryGradeDto } from '../dtos/query-grade.dto';
import { Grade } from '@new-hros/libs-sql';
import { GradeRepository } from '../repositories/grade.repository';
import { PaginatedResult } from '../repositories/grade.repository.interface';

export interface GradeWithPendingChange extends Grade {
  pendingChange?: {
    changeId: string;
    action: string;
    status: EffectiveChangeStatus;
    effectiveAt: Date;
    payload: Record<string, unknown>;
  } | null;
}

@Injectable()
export class GradeQueryService {
  private readonly logger = new Logger(GradeQueryService.name);

  constructor(
    private readonly gradeRepository: GradeRepository,
    private readonly effectiveChangeRepository: EffectiveChangeRepository,
  ) {}

  async find(
    query?: QueryGradeDto,
    authContext?: AuthContext | null,
  ): Promise<PaginatedResult<Grade>> {
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);

    const page = query?.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query?.limit && query.limit > 0 ? Math.min(Number(query.limit), 100) : 20;

    return this.gradeRepository.find(tenantId, companyId, {
      page,
      limit,
      search: query?.search,
      status: query?.status,
    });
  }

  async findById(id: string, authContext?: AuthContext | null): Promise<GradeWithPendingChange> {
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);

    const grade = await this.gradeRepository.findById(tenantId, companyId, id);
    if (!grade) {
      throw new NotFoundException(`Grade with ID '${id}' not found`);
    }

    const pendingChange = await this.effectiveChangeRepository.findPendingChange(
      companyId,
      'grade',
      id,
    );

    const result: GradeWithPendingChange = {
      ...grade,
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
