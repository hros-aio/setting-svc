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
import { AuthGuard, CurrentUser, PermissionGuard, RequirePermission } from '@new-hros/libs-apis';
import { AuthContext } from '@new-hros/libs-core';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { CreateDepartmentDto } from '../dtos/create-department.dto';
import { DeactivateDepartmentDto, QueryDepartmentDto } from '../dtos/query-department.dto';
import { UpdateDepartmentDto } from '../dtos/update-department.dto';
import { DepartmentEntity } from '../entities/department.entity';
import {
  DepartmentTreeNode,
  PaginatedResult,
} from '../repositories/department.repository.interface';
import { DepartmentService } from '../services/department.service';

@Controller('departments')
@UseGuards(AuthGuard, PermissionGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('department:create')
  async create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<DepartmentEntity> {
    return this.departmentService.create(dto, authContext);
  }

  @Get()
  @RequirePermission('department:read')
  async findActiveDepartments(
    @Query() query: QueryDepartmentDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<PaginatedResult<DepartmentEntity> | DepartmentTreeNode[]> {
    return this.departmentService.findActiveDepartments(query, authContext);
  }

  @Get(':id')
  @RequirePermission('department:read')
  async findById(
    @Param('id') id: string,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<DepartmentEntity> {
    return this.departmentService.findById(id, authContext);
  }

  @Patch(':id')
  @RequirePermission('department:update')
  async updateDepartment(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<EffectiveChangeEntity> {
    return this.departmentService.scheduleUpdate(id, dto, authContext);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('department:deactivate')
  async deactivateDepartment(
    @Param('id') id: string,
    @Body() dto: DeactivateDepartmentDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<EffectiveChangeEntity> {
    return this.departmentService.scheduleDeactivation(id, dto, authContext);
  }
}
