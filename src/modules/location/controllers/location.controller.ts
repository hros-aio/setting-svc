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
import { Location, PaginatedResult } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { CreateLocationDto } from '../dtos/create-location.dto';
import { DeactivateLocationDto, QueryLocationDto } from '../dtos/query-location.dto';
import { UpdateLocationDto } from '../dtos/update-location.dto';
import { LocationService } from '../services/location.service';

@Controller('locations')
@UseGuards(AuthGuard, PermissionGuard)
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('location:create')
  async create(@Body() dto: CreateLocationDto): Promise<Location> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.locationService.create(dto, companyId);
  }

  @Get()
  @RequirePermission('location:read')
  async findActiveLocations(@Query() query: QueryLocationDto): Promise<PaginatedResult<Location>> {
    return this.locationService.findActiveLocations(query);
  }

  @Get(':id')
  @RequirePermission('location:read')
  async findById(@Param('id') id: string): Promise<Location> {
    return this.locationService.findById(id);
  }

  @Patch(':id')
  @RequirePermission('location:update')
  async updateLocation(@Param('id') id: string, @Body() dto: UpdateLocationDto): Promise<Location> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.locationService.scheduleUpdate(id, dto, companyId);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('location:deactivate')
  async deactivateLocation(
    @Param('id') id: string,
    @Body() dto: DeactivateLocationDto,
  ): Promise<EffectiveChangeEntity> {
    const companyId = RequestContextService.getUser().employee!.companyId!;
    return this.locationService.scheduleDeactivation(id, dto, companyId);
  }
}
