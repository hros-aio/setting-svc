import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard, PermissionGuard, RequirePermission } from '@new-hros/libs-apis';
import { PaginatedResult } from '@new-hros/libs-sql';
import { InitiateEmployeeTransferDto } from '../dtos/initiate-employee-transfer.dto';
import {
  QueryEmployeeTransferDto,
  QueryPendingTransferDto,
} from '../dtos/query-employee-transfer.dto';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferQueryService } from '../services/employee-transfer-query.service';
import { EmployeeTransferService } from '../services/employee-transfer.service';

@ApiTags('Employee Transfers')
@ApiBearerAuth()
@Controller('employee-transfers')
@UseGuards(AuthGuard, PermissionGuard)
export class EmployeeTransferController {
  constructor(
    private readonly employeeTransferService: EmployeeTransferService,
    private readonly employeeTransferQueryService: EmployeeTransferQueryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('employee-transfer:create')
  @ApiOperation({ summary: 'Initiate and schedule an inter-company employee transfer' })
  @ApiResponse({
    status: 201,
    description: 'Transfer scheduled successfully with PENDING status',
    type: EmployeeTransferEntity,
  })
  @ApiResponse({ status: 400, description: 'Invalid input or effective date' })
  @ApiResponse({ status: 404, description: 'Destination company or employee not found' })
  @ApiResponse({ status: 409, description: 'Active pending transfer already exists for employee' })
  @ApiResponse({ status: 422, description: 'Destination master data reference violation' })
  async initiateTransfer(
    @Body() dto: InitiateEmployeeTransferDto,
  ): Promise<EmployeeTransferEntity> {
    return this.employeeTransferService.initiateTransfer(dto);
  }

  @Get('pending')
  @RequirePermission('employee-transfer:read')
  @ApiOperation({ summary: 'Get current pending transfer for an employee' })
  @ApiResponse({
    status: 200,
    description: 'Active pending transfer details or null',
    type: EmployeeTransferEntity,
  })
  async getPendingTransfer(
    @Query() query: QueryPendingTransferDto,
  ): Promise<EmployeeTransferEntity | null> {
    return this.employeeTransferQueryService.findPendingByEmployee(query.employeeId);
  }

  @Get('history')
  @RequirePermission('employee-transfer:read')
  @ApiOperation({ summary: 'Get chronological transfer history for an employee' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of historical employee transfers',
  })
  async getTransferHistory(
    @Query() query: QueryEmployeeTransferDto,
  ): Promise<PaginatedResult<EmployeeTransferEntity>> {
    return this.employeeTransferQueryService.findHistory(query);
  }
}
