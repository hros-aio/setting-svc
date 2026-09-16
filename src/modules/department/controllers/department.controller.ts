import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, PermissionGuard, RequirePermission } from '@new-hros/libs-apis';
import { RequestContextService } from '@new-hros/libs-core';
import { Department, PaginatedResult } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { CreateDepartmentDto } from '../dtos/create-department.dto';
import { DeactivateDepartmentDto, QueryDepartmentDto } from '../dtos/query-department.dto';
import { UpdateDepartmentDto } from '../dtos/update-department.dto';
import { DepartmentTreeNode } from '../repositories/department.repository.interface';
import { DepartmentService } from '../services/department.service';

@Controller('departments')
@UseGuards(AuthGuard, PermissionGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('department:create')
  async create(@Body() dto: CreateDepartmentDto): Promise<Department> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.departmentService.create(dto, companyId);
  }

  @Get()
  @RequirePermission('department:read')
  async findActiveDepartments(
    @Query() query: QueryDepartmentDto,
  ): Promise<PaginatedResult<Department> | DepartmentTreeNode[]> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.departmentService.findActiveDepartments(companyId, query);
  }

  @Get(':id')
  @RequirePermission('department:read')
  async findById(@Param('id') id: string): Promise<Department> {
    return this.departmentService.findById(id);
  }

  @Patch(':id')
  @RequirePermission('department:update')
  async updateDepartment(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<EffectiveChangeEntity> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.departmentService.scheduleUpdate(id, dto, companyId);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('department:deactivate')
  async deactivateDepartment(
    @Param('id') id: string,
    @Body() dto: DeactivateDepartmentDto,
  ): Promise<EffectiveChangeEntity> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.departmentService.scheduleDeactivation(id, dto, companyId);
  }
}
