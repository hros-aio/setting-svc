import {
  BadRequestException,
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
import { AuthGuard, CurrentUser, PermissionGuard, RequirePermission } from '@new-hros/libs-apis';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { TenantScopeGuard } from '../../../common/guards';
import { InitiateEmployeeTransferDto } from '../dtos/initiate-employee-transfer.dto';
import {
  QueryEmployeeTransferDto,
  QueryPendingTransferDto,
} from '../dtos/query-employee-transfer.dto';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferPaginatedResult } from '../repositories/employee-transfer.repository.interface';
import { EmployeeTransferQueryService } from '../services/employee-transfer-query.service';
import { EmployeeTransferService } from '../services/employee-transfer.service';

@ApiTags('Employee Transfers')
@ApiBearerAuth()
@Controller('employee-transfers')
@UseGuards(AuthGuard, PermissionGuard, TenantScopeGuard)
export class EmployeeTransferController {
  constructor(
    private readonly employeeTransferService: EmployeeTransferService,
    private readonly employeeTransferQueryService: EmployeeTransferQueryService,
  ) {}

  private resolveTenantId(authContext?: AuthContext, explicitTenantId?: string): string {
    const tenantId =
      explicitTenantId || authContext?.tenantCode || RequestContextService.getTenantCode();

    if (!tenantId) {
      throw new BadRequestException('Cannot determine tenant from request context');
    }

    return tenantId;
  }

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
    @CurrentUser() authContext?: AuthContext,
  ): Promise<EmployeeTransferEntity> {
    const tenantId = this.resolveTenantId(authContext, dto.tenantId);

    return this.employeeTransferService.initiateTransfer(
      tenantId,
      dto.companyId,
      dto.employeeId,
      dto,
      authContext,
    );
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
    @CurrentUser() authContext?: AuthContext,
  ): Promise<EmployeeTransferEntity | null> {
    const tenantId = this.resolveTenantId(authContext, query.tenantId);

    return this.employeeTransferQueryService.findPendingByEmployee(tenantId, query.employeeId);
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
    @CurrentUser() authContext?: AuthContext,
  ): Promise<EmployeeTransferPaginatedResult<EmployeeTransferEntity>> {
    const tenantId = this.resolveTenantId(authContext, query.tenantId);

    return this.employeeTransferQueryService.findHistoryByEmployee(
      tenantId,
      query.employeeId,
      query,
    );
  }
}
