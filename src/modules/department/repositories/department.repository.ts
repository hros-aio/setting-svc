import { Injectable } from '@nestjs/common';
import {
  BaseRepository,
  Department,
  PaginatedResult,
  PaginationOptions,
  TransactionService,
} from '@new-hros/libs-sql';
import { In } from 'typeorm';
import { MasterDataStatus } from '../../../enums';
import { DepartmentTreeNode } from './department.repository.interface';

@Injectable()
export class DepartmentRepository extends BaseRepository<Department> {
  constructor(transactionService: TransactionService) {
    super(Department, transactionService);
  }

  async findByIdWithParent(id: string): Promise<Department | null> {
    return this.findById(id, {
      relations: ['parentDepartment'],
    });
  }

  async findByCode(companyId: string, code: string): Promise<Department | null> {
    return this.findOne({
      companyId,
      code,
    });
  }

  async findActiveDepartments(
    companyId: string,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Department>> {
    return this.find(
      {
        companyId,
        status: MasterDataStatus.ACTIVE,
      },
      {
        pagination,
      },
    );
  }

  async findActiveDepartmentTree(companyId: string): Promise<DepartmentTreeNode[]> {
    const allActive = await this.find({
      companyId,
      status: MasterDataStatus.ACTIVE,
    });

    const nodeMap = new Map<string, DepartmentTreeNode>();
    allActive.forEach((dept) => {
      nodeMap.set(dept.id, { ...dept, children: [] });
    });

    const roots: DepartmentTreeNode[] = [];
    allActive.forEach((dept) => {
      const node = nodeMap.get(dept.id)!;
      if (dept.parentDepartmentId && nodeMap.has(dept.parentDepartmentId)) {
        const parent = nodeMap.get(dept.parentDepartmentId)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  async hasActiveOrScheduled(companyId: string): Promise<boolean> {
    return this.exists({
      where: {
        companyId,
        status: In([MasterDataStatus.ACTIVE, MasterDataStatus.SCHEDULED]),
      },
    });
  }

  async countAllDepartmentsByCompany(companyId: string): Promise<number> {
    return this.repository.count({
      where: {
        tenantCode: this.tenantCode,
        companyId,
      },
    });
  }

  async findAncestorChain(parentDepartmentId: string, maxDepth: number = 50): Promise<string[]> {
    const ancestors: string[] = [];
    let currentId: string = parentDepartmentId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      ancestors.push(currentId);
      const parent = await this.findById(currentId);
      if (!parent || !parent.parentDepartmentId) {
        break;
      }
      if (ancestors.includes(parent.parentDepartmentId)) {
        ancestors.push(parent.parentDepartmentId);
        break;
      }
      currentId = parent.parentDepartmentId;
      depth++;
    }

    return ancestors;
  }

  async updateStatus(id: string, status: MasterDataStatus, userId?: string): Promise<Department> {
    const department = new Department();
    department.status = status;
    if (userId) {
      department.updatedBy = userId;
    }

    return this.update(id, department);
  }
}
