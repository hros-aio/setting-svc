import { Injectable, Logger } from '@nestjs/common';
import { PaginatedResult } from '@new-hros/libs-sql';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { EmployeeReferenceRepository } from '../../employee-reference/repositories/employee-reference.repository';
import { QueryPocDto } from '../dtos/query-poc.dto';
import { PocRepository } from '../repositories/poc.repository';

export interface ActivePocResponse {
  id: string;
  pocType: string;
  employeeId: string;
  employeeNumber?: string;
  displayName?: string;
  employmentStatus?: string;
  isHolderInactive: boolean;
  status: string;
  effectiveAt: Date;
  hasPendingChange: boolean;
  pendingChange?: {
    id: string;
    changeType: string;
    effectiveAt: Date;
    newEmployeeId?: string;
  };
}

export interface PocHistoryItemResponse {
  id: string;
  pocType: string;
  employeeId: string;
  displayName?: string;
  status: string;
  effectiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PocQueryService {
  private readonly logger = new Logger(PocQueryService.name);

  constructor(
    private readonly pocRepository: PocRepository,
    private readonly employeeReferenceRepository: EmployeeReferenceRepository,
    private readonly effectiveChangeRepository: EffectiveChangeRepository,
  ) {}

  async findActiveByCompany(companyId: string): Promise<ActivePocResponse[]> {
    const pocs = await this.pocRepository.findActiveByCompany(companyId);

    if (!pocs.length) {
      return [];
    }

    const employeeIds = pocs.map((p) => p.employeeId);
    const employeeRefs = await this.employeeReferenceRepository.findByIds(employeeIds);
    const empMap = new Map(employeeRefs.map((e) => [e.id, e]));

    const results: ActivePocResponse[] = [];

    for (const poc of pocs) {
      const emp = empMap.get(poc.employeeId);
      const isHolderInactive =
        !emp ||
        (emp.employmentStatus ? emp.employmentStatus.toUpperCase() === 'TERMINATED' : false);

      const pendingChange = await this.effectiveChangeRepository.findPendingChange(
        companyId,
        'poc',
        poc.id,
      );

      results.push({
        id: poc.id,
        pocType: poc.pocType,
        employeeId: poc.employeeId,
        employeeNumber: emp?.employeeNumber,
        displayName: emp?.displayName,
        employmentStatus: emp?.employmentStatus,
        isHolderInactive,
        status: poc.status,
        effectiveAt: poc.effectiveAt,
        hasPendingChange: !!pendingChange,
        pendingChange: pendingChange
          ? {
              id: pendingChange.id,
              changeType: pendingChange.operation,
              effectiveAt: pendingChange.effectiveAt,
              newEmployeeId: pendingChange.payload?.newEmployeeId as string | undefined,
            }
          : undefined,
      });
    }

    return results;
  }

  async findHistoryByCompany(
    companyId: string,
    query: QueryPocDto,
  ): Promise<PaginatedResult<PocHistoryItemResponse>> {
    const result = await this.pocRepository.findHistoryByCompany(companyId, {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      pocType: query.pocType,
    });

    const employeeIds = result.data.map((p) => p.employeeId);
    const employeeRefs = await this.employeeReferenceRepository.findByIds(employeeIds);
    const empMap = new Map(employeeRefs.map((e) => [e.id, e]));

    return {
      ...result,
      data: result.data.map((poc) => {
        const emp = empMap.get(poc.employeeId);
        return {
          ...poc,
          displayName: emp?.displayName,
        };
      }),
    };
  }
}
