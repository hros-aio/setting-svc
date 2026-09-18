import { Injectable } from '@nestjs/common';
import { BaseRepository, TransactionService } from '@new-hros/libs-sql';
import { In } from 'typeorm';
import { EmployeeReferenceEntity } from '../entities/employee-reference.entity';

@Injectable()
export class EmployeeReferenceRepository extends BaseRepository<EmployeeReferenceEntity> {
  constructor(transactionService: TransactionService) {
    super(EmployeeReferenceEntity, transactionService);
  }

  async findByCompanyAndEmployeeId(
    companyId: string,
    employeeId: string,
  ): Promise<EmployeeReferenceEntity | null> {
    return this.findOne({
      companyId,
      id: employeeId,
    });
  }

  async findByIds(Ids: string[]): Promise<EmployeeReferenceEntity[]> {
    if (!Ids.length) {
      return [];
    }
    return this.find({
      id: In(Ids),
    });
  }
}
