import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource } from 'typeorm';
import { EffectiveDateUtil } from '../../../common/utils/effective-date.util';
import {
  AggregateType,
  ChangeOperation,
  EffectiveChangeEventType,
  EffectiveChangeStatus,
  MasterDataStatus,
  OutboxStatus,
  SetupStepType,
} from '../../../enums';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { CreateLocationDto } from '../dtos/create-location.dto';
import { DeactivateLocationDto, QueryLocationDto } from '../dtos/query-location.dto';
import { UpdateLocationDto } from '../dtos/update-location.dto';
import { LocationEntity } from '../entities/location.entity';
import { LocationRepository } from '../repositories/location.repository';
import { PaginatedResult } from '../repositories/location.repository.interface';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionService: TransactionService,
    private readonly locationRepository: LocationRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly companySetupStepRepository: CompanySetupStepRepository,
    private readonly effectiveChangeRepository: EffectiveChangeRepository,
  ) {}

  async create(dto: CreateLocationDto, authContext?: AuthContext | null): Promise<LocationEntity> {
    const userId = authContext?.userId;
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate, companyTimezone } = await this.validateEffectiveDate(
      tenantId,
      companyId,
      dto.effectiveAt,
    );

    // 2. Auto-generate location code by rule "LO00001" based on total count in company (including deleted)
    const existingCount = await this.locationRepository.countAllLocationsByCompany(
      tenantId,
      companyId,
    );
    const nextSeq = existingCount + 1;
    const generatedCode = `LO${String(nextSeq).padStart(5, '0')}`;

    // 3. Headquarter pre-check
    if (dto.isHeadquarter) {
      await this.verifyHeadquarterUniqueness(tenantId, companyId);
    }

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      // 4. Persist Location in scheduled status
      const location = await this.locationRepository.createAndSave(
        {
          tenantId,
          companyId,
          code: generatedCode,
          name: dto.name,
          description: dto.description,
          countryCode: dto.countryCode,
          timezone: dto.timezone || companyTimezone,
          address: dto.address,
          isHeadquarter: dto.isHeadquarter ?? false,
          status: MasterDataStatus.SCHEDULED,
          effectiveAt: effectiveAtDate,
          createdBy: userId,
          updatedBy: userId,
        },
        manager,
      );

      // 5. Complete LOCATION setup step if needed
      await this.companySetupStepRepository.markStepCompleted({
        tenantId,
        companyId,
        stepType: SetupStepType.LOCATION,
        completedBy: userId,
        entityManager: manager,
      });

      // 6. Write outbox event for scheduling
      const outboxRepo = manager.getRepository(OutboxEventEntity);
      const scheduledEvent = outboxRepo.create({
        aggregateType: AggregateType.LOCATION,
        aggregateId: location.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: location.id,
          entityType: 'location',
          operation: 'CREATE',
          effectiveAt: location.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(scheduledEvent);

      return location;
    });
  }

  async findActiveLocations(
    query?: QueryLocationDto,
    authContext?: AuthContext | null,
  ): Promise<PaginatedResult<LocationEntity>> {
    const tenantId = authContext?.tenantCode || RequestContextService.getTenantCode();
    const companyId = RequestContextService.current()?.companyId;

    const page = query?.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query?.limit && query.limit > 0 ? Math.min(Number(query.limit), 100) : 20;

    if (!tenantId || !companyId) {
      this.logger.warn(
        `Cannot find active locations: missing ${!tenantId ? 'tenantId' : 'companyId'} from request context`,
      );
      return {
        data: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }

    return this.locationRepository.findActiveLocations(tenantId, companyId, {
      page,
      limit,
      search: query?.search,
    });
  }

  async findById(id: string, authContext?: AuthContext | null): Promise<LocationEntity> {
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);

    const location = await this.locationRepository.findById(tenantId, companyId, id);
    if (!location) {
      throw new NotFoundException(`Location with ID '${id}' not found`);
    }
    return location;
  }

  async scheduleUpdate(
    locationId: string,
    dto: UpdateLocationDto,
    authContext?: AuthContext | null,
  ): Promise<LocationEntity> {
    const userId = authContext?.userId;
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);

    // 1. Verify location exists and is active
    const location = await this.verifyActiveLocation(tenantId, companyId, locationId, 'updates');

    // 2. Resolve company timezone and validate effectiveAt
    const { effectiveAtDate } = await this.validateEffectiveDate(
      tenantId,
      companyId,
      dto.effectiveAt,
    );

    // 3. Headquarter pre-check if updating isHeadquarter to true
    if (dto.isHeadquarter === true) {
      await this.verifyHeadquarterUniqueness(tenantId, companyId, locationId);
    }

    // 4. Single pending change check (INV-007)
    await this.verifyNoPendingChange(companyId, locationId, 'scheduling a new update');

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      // Mutate location fields immediately in DB
      if (dto.name !== undefined) location.name = dto.name;
      if (dto.description !== undefined) location.description = dto.description;
      if (dto.countryCode !== undefined) location.countryCode = dto.countryCode;
      if (dto.timezone !== undefined) location.timezone = dto.timezone;
      if (dto.address !== undefined) location.address = dto.address;
      if (dto.isHeadquarter !== undefined) location.isHeadquarter = dto.isHeadquarter;
      location.updatedBy = userId;

      const updatedLocation = await this.locationRepository.save(location, manager);

      const payload: Record<string, unknown> = {};
      if (dto.name !== undefined) payload.name = dto.name;
      if (dto.description !== undefined) payload.description = dto.description;
      if (dto.countryCode !== undefined) payload.countryCode = dto.countryCode;
      if (dto.timezone !== undefined) payload.timezone = dto.timezone;
      if (dto.address !== undefined) payload.address = dto.address;
      if (dto.isHeadquarter !== undefined) payload.isHeadquarter = dto.isHeadquarter;

      const savedChange = await this.effectiveChangeRepository.createAndSave(
        {
          tenantId,
          companyId,
          entityType: 'location',
          entityId: locationId,
          operation: ChangeOperation.UPDATE,
          effectiveAt: effectiveAtDate,
          status: EffectiveChangeStatus.SCHEDULED,
          payload,
          expectedUpdatedAt: updatedLocation.updatedAt,
          createdBy: userId,
        },
        manager,
      );

      // Outbox write for schedule-worker
      const outboxRepo = manager.getRepository(OutboxEventEntity);
      const scheduledEvent = outboxRepo.create({
        aggregateType: AggregateType.EFFECTIVE_CHANGE,
        aggregateId: savedChange.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: savedChange.id,
          entityType: 'location',
          operation: 'UPDATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(scheduledEvent);

      return updatedLocation;
    });
  }

  async scheduleDeactivation(
    locationId: string,
    dto: DeactivateLocationDto,
    authContext?: AuthContext | null,
  ): Promise<EffectiveChangeEntity> {
    const { tenantId, companyId } = this.resolveTenantAndCompany(authContext);
    const userId = authContext?.userId;

    // 1. Verify location exists and is active
    const location = await this.verifyActiveLocation(
      tenantId,
      companyId,
      locationId,
      'deactivation',
    );

    // 2. Resolve company timezone and validate effectiveAt
    const { effectiveAtDate } = await this.validateEffectiveDate(
      tenantId,
      companyId,
      dto.effectiveAt,
    );

    // 3. Single pending change check (INV-007)
    await this.verifyNoPendingChange(companyId, locationId, 'scheduling deactivation');

    return this.transactionService.runInTransaction(async () => {
      const manager = this.dataSource.manager;

      const savedChange = await this.effectiveChangeRepository.createAndSave(
        {
          tenantId,
          companyId,
          entityType: 'location',
          entityId: locationId,
          operation: ChangeOperation.DEACTIVATE,
          effectiveAt: effectiveAtDate,
          status: EffectiveChangeStatus.SCHEDULED,
          payload: {},
          expectedUpdatedAt: location.updatedAt,
          createdBy: userId,
        },
        manager,
      );

      const outboxRepo = manager.getRepository(OutboxEventEntity);
      const scheduledEvent = outboxRepo.create({
        aggregateType: AggregateType.EFFECTIVE_CHANGE,
        aggregateId: savedChange.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: savedChange.id,
          entityType: 'location',
          operation: 'DEACTIVATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantId,
        },
        status: OutboxStatus.PENDING,
      });
      await outboxRepo.save(scheduledEvent);

      return savedChange;
    });
  }

  // --- Common Verification Helpers ---

  private resolveTenantAndCompany(authContext?: AuthContext | null): {
    tenantId: string;
    companyId: string;
  } {
    const tenantId = authContext?.tenantCode || RequestContextService.getTenantCode();
    const companyId = RequestContextService.current()?.companyId;

    if (!tenantId) {
      throw new BadRequestException('Cannot determine tenant from request context');
    }
    if (!companyId) {
      throw new BadRequestException('Cannot determine company from request context');
    }

    return { tenantId, companyId };
  }

  private async validateEffectiveDate(
    tenantId: string,
    companyId: string,
    effectiveAt: string,
  ): Promise<{ effectiveAtDate: Date; companyTimezone?: string }> {
    const company = await this.companyRepository.findByIdAndTenant(companyId, tenantId);
    if (!company) {
      throw new NotFoundException(`Company with ID '${companyId}' not found`);
    }

    const effectiveAtDate = new Date(effectiveAt);
    if (isNaN(effectiveAtDate.getTime())) {
      throw new BadRequestException('Invalid effectiveAt date format');
    }

    const { isValid, cutoff } = EffectiveDateUtil.validateFutureEffectiveDate(
      effectiveAtDate,
      company.timezone,
    );
    if (!isValid) {
      throw new BadRequestException(
        `effectiveAt must be scheduled on or after the end of the current business day (${cutoff.toISOString()}) in company timezone (${company.timezone || 'UTC'})`,
      );
    }

    return { effectiveAtDate, companyTimezone: company.timezone };
  }

  private async verifyActiveLocation(
    tenantId: string,
    companyId: string,
    locationId: string,
    action: 'updates' | 'deactivation' = 'updates',
  ): Promise<LocationEntity> {
    const location = await this.locationRepository.findById(tenantId, companyId, locationId);
    if (!location) {
      throw new NotFoundException(`Location with ID '${locationId}' not found`);
    }
    if (location.status !== MasterDataStatus.ACTIVE) {
      throw new BadRequestException(
        action === 'deactivation'
          ? 'Only active locations can be deactivated'
          : 'Only active locations can have updates scheduled',
      );
    }
    return location;
  }

  private async verifyHeadquarterUniqueness(
    tenantId: string,
    companyId: string,
    excludeLocationId?: string,
  ): Promise<void> {
    const hasOtherHq = await this.locationRepository.hasActiveOrScheduledHeadquarter(
      tenantId,
      companyId,
      excludeLocationId,
    );
    if (hasOtherHq) {
      throw new ConflictException(
        excludeLocationId
          ? 'Another headquarter location is already assigned or scheduled for this company'
          : 'A headquarter location is already assigned or scheduled for this company',
      );
    }
  }

  private async verifyNoPendingChange(
    companyId: string,
    locationId: string,
    action: string = 'scheduling a new update',
  ): Promise<void> {
    const existingPending = await this.effectiveChangeRepository.findPendingChange(
      companyId,
      'location',
      locationId,
    );
    if (existingPending) {
      throw new ConflictException(
        `A pending change is already scheduled for this location. Cancel it before ${action}.`,
      );
    }
  }
}
