import { Injectable } from '@nestjs/common';
import {
  BaseRepository,
  PaginatedResult,
  PaginationOptions,
  TransactionService,
} from '@new-hros/libs-sql';
import { EmployeeTransferStatus } from '../../../enums';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';

@Injectable()
export class EmployeeTransferRepository extends BaseRepository<EmployeeTransferEntity> {
  constructor(transactionService: TransactionService) {
    super(EmployeeTransferEntity, transactionService);
  }

  async findPendingByEmployeeId(employeeId: string): Promise<EmployeeTransferEntity | null> {
    return this.findOne(
      {
        employeeId,
        status: EmployeeTransferStatus.PENDING,
      },
      {
        relations: [
          'sourceCompany',
          'destinationCompany',
          'destinationLocation',
          'destinationDepartment',
          'destinationGrade',
          'destinationJobTitle',
        ],
      },
    );
  }

  async findHistoryByEmployeeId(
    employeeId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<EmployeeTransferEntity>> {
    return this.find(
      {
        employeeId,
      },
      {
        relations: [
          'sourceCompany',
          'destinationCompany',
          'destinationLocation',
          'destinationDepartment',
          'destinationGrade',
          'destinationJobTitle',
        ],
        order: {
          createdAt: 'DESC',
        },
        pagination: options,
      },
    );
  }
}
