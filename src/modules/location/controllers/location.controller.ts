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
import {
  AuthGuard,
  CompanyScopeGuard,
  CurrentUser,
  PermissionGuard,
  RequirePermission,
  TenantScopeGuard,
} from '@new-hros/libs-apis';
import { AuthContext } from '@new-hros/libs-core';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { CreateLocationDto } from '../dtos/create-location.dto';
import { DeactivateLocationDto, QueryLocationDto } from '../dtos/query-location.dto';
import { UpdateLocationDto } from '../dtos/update-location.dto';
import { Location } from '@new-hros/libs-sql';
import { PaginatedResult } from '../repositories/location.repository.interface';
import { LocationService } from '../services/location.service';

@Controller('locations')
@UseGuards(AuthGuard, PermissionGuard, TenantScopeGuard, CompanyScopeGuard)
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('location:create')
  async create(
    @Body() dto: CreateLocationDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<Location> {
    return this.locationService.create(dto, authContext);
  }

  @Get()
  @RequirePermission('location:read')
  async findActiveLocations(
    @Query() query: QueryLocationDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<PaginatedResult<Location>> {
    return this.locationService.findActiveLocations(query, authContext);
  }

  @Get(':id')
  @RequirePermission('location:read')
  async findById(
    @Param('id') id: string,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<Location> {
    return this.locationService.findById(id, authContext);
  }

  @Patch(':id')
  @RequirePermission('location:update')
  async updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<Location> {
    return this.locationService.scheduleUpdate(id, dto, authContext);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('location:deactivate')
  async deactivateLocation(
    @Param('id') id: string,
    @Body() dto: DeactivateLocationDto,
    @CurrentUser() authContext?: AuthContext,
  ): Promise<EffectiveChangeEntity> {
    return this.locationService.scheduleDeactivation(id, dto, authContext);
  }
}
