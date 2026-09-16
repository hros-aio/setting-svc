import { Injectable } from '@nestjs/common';
import {
  BaseRepository,
  Grade,
  PaginatedResult,
  PaginationOptions,
  TransactionService,
} from '@new-hros/libs-sql';
import { FindOptionsWhere, ILike, In } from 'typeorm';
import { MasterDataStatus } from '../../../enums';

@Injectable()
export class GradeRepository extends BaseRepository<Grade> {
  constructor(transactionService: TransactionService) {
    super(Grade, transactionService);
  }

  async findByIdWithSource(id: string): Promise<Grade | null> {
    return this.findById(id, {
      relations: ['sourceGrade'],
    });
  }

  async findByCode(companyId: string, code: string): Promise<Grade | null> {
    return this.findOne({
      companyId,
      code,
    });
  }

  async findGrades(
    companyId: string,
    pagination?: PaginationOptions,
    search?: string,
    status?: string,
  ): Promise<PaginatedResult<Grade>> {
    const baseWhere: FindOptionsWhere<Grade> = {
      companyId,
    };

    if (status && status !== 'all') {
      baseWhere.status = status as MasterDataStatus;
    } else if (!status) {
      baseWhere.status = MasterDataStatus.ACTIVE;
    }

    let where: FindOptionsWhere<Grade> | FindOptionsWhere<Grade>[] = baseWhere;
    if (search) {
      where = [
        { ...baseWhere, name: ILike(`%${search}%`) },
        { ...baseWhere, code: ILike(`%${search}%`) },
      ];
    }

    return this.find(where as FindOptionsWhere<Grade>, {
      pagination: {
        page: pagination?.page ?? 1,
        limit: pagination?.limit ?? 20,
      },
      order: {
        rankOrder: 'ASC',
        name: 'ASC',
      },
      relations: ['sourceGrade'],
    });
  }

  async hasActiveOrScheduled(companyId: string): Promise<boolean> {
    return this.exists({
      where: {
        companyId,
        status: In([MasterDataStatus.ACTIVE, MasterDataStatus.SCHEDULED]),
      },
    });
  }

  async countAllGradesByCompany(companyId: string): Promise<number> {
    return this.repository.count({
      where: {
        tenantCode: this.tenantCode,
        companyId,
      },
    });
  }

  async updateStatus(id: string, status: MasterDataStatus, userId?: string): Promise<Grade> {
    const grade = new Grade();
    grade.status = status;
    if (userId) {
      grade.updatedBy = userId;
    }

    return this.update(id, grade);
  }

  async updateFields(id: string, fields: Partial<Grade>, userId?: string): Promise<Grade> {
    const grade = await this.findById(id, { required: true });
    Object.assign(grade, fields);
    if (userId) {
      grade.updatedBy = userId;
    }
    return this.repository.save(grade);
  }
}
