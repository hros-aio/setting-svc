import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '@new-hros/libs-sql';
import { QueryEmployeeTransferDto } from '../dtos/query-employee-transfer.dto';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferRepository } from '../repositories/employee-transfer.repository';

@Injectable()
export class EmployeeTransferQueryService {
  constructor(private readonly employeeTransferRepository: EmployeeTransferRepository) {}

  async findPendingByEmployee(employeeId: string): Promise<EmployeeTransferEntity | null> {
    return this.employeeTransferRepository.findPendingByEmployeeId(employeeId);
  }

  async findHistory(
    query: QueryEmployeeTransferDto,
  ): Promise<PaginatedResult<EmployeeTransferEntity>> {
    return this.employeeTransferRepository.findHistoryByEmployeeId(query.employeeId, query);
  }
}
