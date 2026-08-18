import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { EmployeeReferenceRepository } from '../../employee-reference/repositories/employee-reference.repository';
import { QueryPocDto } from '../dtos/query-poc.dto';
import { PocRepository } from '../repositories/poc.repository';
import { PocPaginatedResult } from '../repositories/poc.repository.interface';

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

  async findActiveByCompany(
    companyId: string,
    authContext?: AuthContext | null,
  ): Promise<ActivePocResponse[]> {
    const tenantId = this.resolveTenantId(authContext);
    const pocs = await this.pocRepository.findActiveByCompany(tenantId, companyId);

    if (!pocs.length) {
      return [];
    }

    const employeeIds = pocs.map((p) => p.employeeId);
    const employeeRefs = await this.employeeReferenceRepository.findByEmployeeIds(
      tenantId,
      employeeIds,
    );
    const empMap = new Map(employeeRefs.map((e) => [e.employeeId, e]));

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
    authContext?: AuthContext | null,
  ): Promise<PocPaginatedResult<PocHistoryItemResponse>> {
    const tenantId = this.resolveTenantId(authContext);
    const paginated = await this.pocRepository.findHistory(tenantId, companyId, {
      page: query.page,
      limit: query.limit,
      pocType: query.pocType,
    });

    const employeeIds = paginated.items.map((p) => p.employeeId);
    const employeeRefs = await this.employeeReferenceRepository.findByEmployeeIds(
      tenantId,
      employeeIds,
    );
    const empMap = new Map(employeeRefs.map((e) => [e.employeeId, e]));

    return {
      items: paginated.items.map((poc) => {
        const emp = empMap.get(poc.employeeId);
        return {
          id: poc.id,
          pocType: poc.pocType,
          employeeId: poc.employeeId,
          displayName: emp?.displayName,
          status: poc.status,
          effectiveAt: poc.effectiveAt,
          createdAt: poc.createdAt,
          updatedAt: poc.updatedAt,
        };
      }),
      meta: paginated.meta,
    };
  }

  private resolveTenantId(authContext?: AuthContext | null): string {
    const tenantId = authContext?.tenantCode || RequestContextService.getTenantCode();
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required but could not be resolved from context');
    }
    return tenantId;
  }
}
