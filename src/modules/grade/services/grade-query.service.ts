import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { Grade, PaginatedResult } from '@new-hros/libs-sql';
import { EffectiveChangeStatus } from '../../../enums';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { QueryGradeDto } from '../dtos/query-grade.dto';
import { GradeRepository } from '../repositories/grade.repository';

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

  async find(companyId: string, query?: QueryGradeDto): Promise<PaginatedResult<Grade>> {
    const page = query?.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query?.limit && query.limit > 0 ? Math.min(Number(query.limit), 100) : 20;

    return this.gradeRepository.findGrades(
      companyId,
      { page, limit },
      query?.search,
      query?.status,
    );
  }

  async findById(id: string, companyId?: string): Promise<GradeWithPendingChange> {
    const grade = await this.gradeRepository.findById(id);
    if (!grade) {
      throw new NotFoundException(`Grade with ID '${id}' not found`);
    }

    const targetCompanyId =
      companyId || RequestContextService.current()?.companyId || grade.companyId;

    const pendingChange = await this.effectiveChangeRepository.findPendingChange(
      targetCompanyId,
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
}
