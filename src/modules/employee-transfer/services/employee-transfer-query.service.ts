import { Injectable } from '@nestjs/common';
import { QueryEmployeeTransferDto } from '../dtos/query-employee-transfer.dto';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferPaginatedResult } from '../repositories/employee-transfer.repository.interface';
import { EmployeeTransferRepository } from '../repositories/employee-transfer.repository';

@Injectable()
export class EmployeeTransferQueryService {
  constructor(private readonly employeeTransferRepository: EmployeeTransferRepository) {}

  async findPendingByEmployee(
    tenantId: string,
    employeeId: string,
  ): Promise<EmployeeTransferEntity | null> {
    return this.employeeTransferRepository.findPendingByEmployeeId(tenantId, employeeId);
  }

  async findHistoryByEmployee(
    tenantId: string,
    employeeId: string,
    options?: QueryEmployeeTransferDto,
  ): Promise<EmployeeTransferPaginatedResult<EmployeeTransferEntity>> {
    return this.employeeTransferRepository.findHistoryByEmployeeId(tenantId, employeeId, options);
  }
}
