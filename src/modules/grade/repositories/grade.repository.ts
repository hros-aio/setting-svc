import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { Grade } from '@new-hros/libs-sql';
import { IGradeRepository, PaginatedResult, PaginationOptions } from './grade.repository.interface';
import { MasterDataStatus } from '../../../enums';

@Injectable()
export class GradeRepository implements IGradeRepository {
  constructor(
    @InjectRepository(Grade)
    private readonly repo: Repository<Grade>,
    private readonly dataSource: DataSource,
  ) {}

  private getRepo(manager?: EntityManager): Repository<Grade> {
    return manager ? manager.getRepository(Grade) : this.repo;
  }

  async findById(
    tenantId: string,
    companyId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<Grade | null> {
    return this.getRepo(manager).findOne({
      where: {
        id,
        tenantId,
        companyId,
      },
      relations: ['sourceGrade'],
    });
  }

  async findByCode(
    tenantId: string,
    companyId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<Grade | null> {
    return this.getRepo(manager).findOne({
      where: {
        tenantId,
        companyId,
        code,
      },
    });
  }

  async find(
    tenantId: string,
    companyId: string,
    pagination?: PaginationOptions,
    manager?: EntityManager,
  ): Promise<PaginatedResult<Grade>> {
    const page = pagination?.page && pagination.page > 0 ? Number(pagination.page) : 1;
    const limit = pagination?.limit && pagination.limit > 0 ? Number(pagination.limit) : 20;
    const skip = (page - 1) * limit;

    const baseWhere: FindOptionsWhere<Grade> = {
      tenantId,
      companyId,
    };

    if (pagination?.status && pagination.status !== 'all') {
      baseWhere.status = pagination.status as MasterDataStatus;
    } else if (!pagination?.status) {
      baseWhere.status = MasterDataStatus.ACTIVE;
    }

    let where: FindOptionsWhere<Grade> | FindOptionsWhere<Grade>[] = baseWhere;
    if (pagination?.search) {
      where = [
        { ...baseWhere, name: ILike(`%${pagination.search}%`) },
        { ...baseWhere, code: ILike(`%${pagination.search}%`) },
      ];
    }

    const [data, total] = await this.getRepo(manager).findAndCount({
      where,
      order: {
        rankOrder: 'ASC',
        name: 'ASC',
      },
      skip,
      take: limit,
      relations: ['sourceGrade'],
    });

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

  async hasActiveOrScheduled(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const count = await this.getRepo(manager).count({
      where: {
        tenantId,
        companyId,
        status: In([MasterDataStatus.ACTIVE, MasterDataStatus.SCHEDULED]),
      },
    });

    return count > 0;
  }

  async countAllGradesByCompany(
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

  async createAndSave(gradeData: Partial<Grade>, manager?: EntityManager): Promise<Grade> {
    const repo = this.getRepo(manager);
    const grade = repo.create(gradeData);
    return repo.save(grade);
  }

  async updateStatus(
    tenantId: string,
    companyId: string,
    id: string,
    status: MasterDataStatus,
    userId?: string,
    manager?: EntityManager,
  ): Promise<Grade> {
    const repo = this.getRepo(manager);
    const grade = await this.findById(tenantId, companyId, id, manager);
    if (!grade) {
      throw new NotFoundException(`Grade with ID '${id}' not found`);
    }

    grade.status = status;
    if (userId) {
      grade.updatedBy = userId;
    }

    return repo.save(grade);
  }

  async updateFields(
    tenantId: string,
    companyId: string,
    id: string,
    fields: Partial<Grade>,
    userId?: string,
    manager?: EntityManager,
  ): Promise<Grade> {
    const repo = this.getRepo(manager);
    const grade = await this.findById(tenantId, companyId, id, manager);
    if (!grade) {
      throw new NotFoundException(`Grade with ID '${id}' not found`);
    }

    Object.assign(grade, fields);
    if (userId) {
      grade.updatedBy = userId;
    }

    return repo.save(grade);
  }

  async save(grade: Grade, manager?: EntityManager): Promise<Grade> {
    const repo = this.getRepo(manager);
    return repo.save(grade);
  }
}
