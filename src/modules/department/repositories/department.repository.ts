import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DepartmentEntity } from '../entities/department.entity';
import {
  DepartmentTreeNode,
  IDepartmentRepository,
  PaginatedResult,
  PaginationOptions,
} from './department.repository.interface';
import { MasterDataStatus } from '../../../enums';

@Injectable()
export class DepartmentRepository implements IDepartmentRepository {
  constructor(
    @InjectRepository(DepartmentEntity)
    private readonly repo: Repository<DepartmentEntity>,
    private readonly dataSource: DataSource,
  ) {}

  private getRepo(manager?: EntityManager): Repository<DepartmentEntity> {
    return manager ? manager.getRepository(DepartmentEntity) : this.repo;
  }

  async findById(
    tenantId: string,
    companyId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<DepartmentEntity | null> {
    return this.getRepo(manager).findOne({
      where: {
        id,
        tenantId,
        companyId,
      },
      relations: ['parentDepartment'],
    });
  }

  async findByCode(
    tenantId: string,
    companyId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<DepartmentEntity | null> {
    return this.getRepo(manager).findOne({
      where: {
        tenantId,
        companyId,
        code,
      },
    });
  }

  async findActiveDepartments(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<DepartmentEntity>> {
    const page = pagination?.page && pagination.page > 0 ? pagination.page : 1;
    const limit = pagination?.limit && pagination.limit > 0 ? pagination.limit : 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.getRepo(manager)
      .createQueryBuilder('dept')
      .leftJoinAndSelect('dept.parentDepartment', 'parent')
      .where('dept.tenant_id = :tenantId', { tenantId })
      .andWhere('dept.company_id = :companyId', { companyId })
      .andWhere('dept.status = :status', { status: MasterDataStatus.ACTIVE });

    if (pagination?.search) {
      queryBuilder.andWhere('(dept.name ILIKE :search OR dept.code ILIKE :search)', {
        search: `%${pagination.search}%`,
      });
    }

    queryBuilder.orderBy('dept.name', 'ASC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findAllDepartments(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<DepartmentEntity>> {
    const page = pagination?.page && pagination.page > 0 ? pagination.page : 1;
    const limit = pagination?.limit && pagination.limit > 0 ? pagination.limit : 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.getRepo(manager)
      .createQueryBuilder('dept')
      .leftJoinAndSelect('dept.parentDepartment', 'parent')
      .where('dept.tenant_id = :tenantId', { tenantId })
      .andWhere('dept.company_id = :companyId', { companyId });

    if (pagination?.search) {
      queryBuilder.andWhere('(dept.name ILIKE :search OR dept.code ILIKE :search)', {
        search: `%${pagination.search}%`,
      });
    }

    queryBuilder.orderBy('dept.created_at', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findActiveDepartmentTree(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<DepartmentTreeNode[]> {
    const allActive = await this.getRepo(manager).find({
      where: {
        tenantId,
        companyId,
        status: MasterDataStatus.ACTIVE,
      },
      order: {
        name: 'ASC',
      },
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

  async hasActiveOrScheduled(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const count = await this.getRepo(manager)
      .createQueryBuilder('dept')
      .where('dept.tenant_id = :tenantId', { tenantId })
      .andWhere('dept.company_id = :companyId', { companyId })
      .andWhere('dept.status IN (:...statuses)', {
        statuses: [MasterDataStatus.ACTIVE, MasterDataStatus.SCHEDULED],
      })
      .getCount();

    return count > 0;
  }

  async countAllDepartmentsByCompany(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<number> {
    return this.getRepo(manager).count({
      where: {
        tenantId,
        companyId,
      },
    });
  }

  async findAncestorChain(
    tenantId: string,
    companyId: string,
    parentDepartmentId: string,
    maxDepth: number = 50,
    manager?: EntityManager,
  ): Promise<string[]> {
    const ancestors: string[] = [];
    let currentId: string | undefined | null = parentDepartmentId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      ancestors.push(currentId);
      const parent = await this.findById(tenantId, companyId, currentId, manager);
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

  async createAndSave(
    departmentData: Partial<DepartmentEntity>,
    manager?: EntityManager,
  ): Promise<DepartmentEntity> {
    const repo = this.getRepo(manager);
    const department = repo.create(departmentData);
    return repo.save(department);
  }

  async updateStatus(
    tenantId: string,
    companyId: string,
    id: string,
    status: MasterDataStatus,
    userId?: string,
    manager?: EntityManager,
  ): Promise<DepartmentEntity> {
    const repo = this.getRepo(manager);
    const department = await this.findById(tenantId, companyId, id, manager);
    if (!department) {
      throw new NotFoundException(`Department with ID '${id}' not found`);
    }

    department.status = status;
    if (userId) {
      department.updatedBy = userId;
    }

    return repo.save(department);
  }

  async updateFields(
    tenantId: string,
    companyId: string,
    id: string,
    fields: Partial<DepartmentEntity>,
    userId?: string,
    manager?: EntityManager,
  ): Promise<DepartmentEntity> {
    const repo = this.getRepo(manager);
    const department = await this.findById(tenantId, companyId, id, manager);
    if (!department) {
      throw new NotFoundException(`Department with ID '${id}' not found`);
    }

    Object.assign(department, fields);
    if (userId) {
      department.updatedBy = userId;
    }

    return repo.save(department);
  }

  async save(department: DepartmentEntity, manager?: EntityManager): Promise<DepartmentEntity> {
    const repo = this.getRepo(manager);
    return repo.save(department);
  }
}
