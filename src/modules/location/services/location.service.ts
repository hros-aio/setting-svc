import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { Location, PaginatedResult, TransactionService } from '@new-hros/libs-sql';
import { isDateString } from 'class-validator';
import { OutboxEventRepository } from '../../company/repositories/outbox-event.repository';
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
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { EffectiveChangeEntity } from '../../effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { CreateLocationDto } from '../dtos/create-location.dto';
import { DeactivateLocationDto, QueryLocationDto } from '../dtos/query-location.dto';
import { UpdateLocationDto } from '../dtos/update-location.dto';
import { LocationRepository } from '../repositories/location.repository';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly transactionService: TransactionService,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly locationRepository: LocationRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly companySetupStepRepository: CompanySetupStepRepository,
    private readonly effectiveChangeRepository: EffectiveChangeRepository,
  ) {}

  async create(dto: CreateLocationDto, companyId: string): Promise<Location> {
    const userId = RequestContextService.getUser().userId;
    const tenantCode = RequestContextService.getTenantCode();

    // 1. Resolve Company and validate future effective date
    const { effectiveAtDate, companyTimezone } = await this.validateEffectiveDate(
      companyId,
      dto.effectiveAt,
    );

    // 2. Auto-generate location code by rule "LO00001" based on total count in company (including deleted)
    const existingCount = await this.locationRepository.countAllLocationsByCompany(companyId);
    const nextSeq = existingCount + 1;
    const generatedCode = `LO${String(nextSeq).padStart(5, '0')}`;

    // 3. Headquarter pre-check
    if (dto.isHeadquarter) {
      await this.verifyHeadquarterUniqueness(companyId);
    }

    return this.transactionService.runInTransaction(async () => {
      // 4. Persist Location in scheduled status
      const location = await this.locationRepository.create({
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
      });

      // 5. Complete LOCATION setup step if needed
      await this.companySetupStepRepository.markStepCompleted({
        companyId,
        stepType: SetupStepType.LOCATION,
        completedBy: userId,
      });

      // 6. Write outbox event for scheduling
      await this.outboxEventRepository.create({
        aggregateType: AggregateType.LOCATION,
        aggregateId: location.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: location.id,
          entityType: 'location',
          operation: 'CREATE',
          effectiveAt: location.effectiveAt,
          targetCompanyId: companyId,
          tenantCode,
        },
        executionTime: location.effectiveAt,
        status: OutboxStatus.PENDING,
      });

      return location;
    });
  }

  async findActiveLocations(query?: QueryLocationDto): Promise<PaginatedResult<Location>> {
    const companyId = RequestContextService.current()?.companyId || '';

    const page = query?.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query?.limit && query.limit > 0 ? Math.min(Number(query.limit), 100) : 20;

    return this.locationRepository.findActive(companyId, {
      page,
      limit,
    });
  }

  async findById(id: string): Promise<Location> {
    return this.locationRepository.findById(id, { required: true });
  }

  async scheduleUpdate(id: string, dto: UpdateLocationDto, companyId: string): Promise<Location> {
    const userId = RequestContextService.getUser().userId;
    const tenantCode = RequestContextService.getTenantCode();
    // 1. Verify location exists and is active
    const location = await this.verifyActiveLocation(id, 'updates');

    // 2. Resolve company timezone and validate effectiveAt
    const { effectiveAtDate } = await this.validateEffectiveDate(companyId, dto.effectiveAt);

    // 3. Headquarter pre-check if updating isHeadquarter to true
    if (dto.isHeadquarter === true) {
      await this.verifyHeadquarterUniqueness(companyId, id);
    }

    // 4. Single pending change check (INV-007)
    await this.verifyNoPendingChange(companyId, id, 'scheduling a new update');

    return this.transactionService.runInTransaction(async () => {
      // Mutate location fields immediately in DB
      if (dto.name !== undefined) location.name = dto.name;
      if (dto.description !== undefined) location.description = dto.description;
      if (dto.countryCode !== undefined) location.countryCode = dto.countryCode;
      if (dto.timezone !== undefined) location.timezone = dto.timezone;
      if (dto.address !== undefined) location.address = dto.address;
      if (dto.isHeadquarter !== undefined) location.isHeadquarter = dto.isHeadquarter;
      location.updatedBy = userId;

      const updatedLocation = await this.locationRepository.update(location.id, location);

      const payload: Record<string, unknown> = {};
      if (dto.name !== undefined) payload.name = dto.name;
      if (dto.description !== undefined) payload.description = dto.description;
      if (dto.countryCode !== undefined) payload.countryCode = dto.countryCode;
      if (dto.timezone !== undefined) payload.timezone = dto.timezone;
      if (dto.address !== undefined) payload.address = dto.address;
      if (dto.isHeadquarter !== undefined) payload.isHeadquarter = dto.isHeadquarter;

      const savedChange = await this.effectiveChangeRepository.create({
        tenantCode,
        companyId,
        entityType: 'location',
        entityId: id,
        operation: ChangeOperation.UPDATE,
        effectiveAt: effectiveAtDate,
        status: EffectiveChangeStatus.SCHEDULED,
        payload,
        expectedUpdatedAt: updatedLocation.updatedAt,
        createdBy: userId,
      });

      // Outbox write for schedule-worker
      await this.outboxEventRepository.create({
        aggregateType: AggregateType.EFFECTIVE_CHANGE,
        aggregateId: savedChange.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: savedChange.id,
          entityType: 'location',
          operation: 'UPDATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantCode,
        },
        executionTime: savedChange.effectiveAt,
        status: OutboxStatus.PENDING,
      });

      return updatedLocation;
    });
  }

  async scheduleDeactivation(
    id: string,
    dto: DeactivateLocationDto,
    companyId: string,
  ): Promise<EffectiveChangeEntity> {
    const userId = RequestContextService.getUser().userId;
    const tenantCode = RequestContextService.getTenantCode();

    // 1. Verify location exists and is active
    const location = await this.verifyActiveLocation(id, 'deactivation');

    // 2. Resolve company timezone and validate effectiveAt
    const { effectiveAtDate } = await this.validateEffectiveDate(companyId, dto.effectiveAt);

    // 3. Single pending change check (INV-007)
    await this.verifyNoPendingChange(companyId, id, 'scheduling deactivation');

    return this.transactionService.runInTransaction(async () => {
      const savedChange = await this.effectiveChangeRepository.create({
        tenantCode,
        companyId,
        entityType: 'location',
        entityId: id,
        operation: ChangeOperation.DEACTIVATE,
        effectiveAt: effectiveAtDate,
        status: EffectiveChangeStatus.SCHEDULED,
        payload: {},
        expectedUpdatedAt: location.updatedAt,
        createdBy: userId,
      });

      await this.outboxEventRepository.create({
        aggregateType: AggregateType.EFFECTIVE_CHANGE,
        aggregateId: savedChange.id,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        payload: {
          changeId: savedChange.id,
          entityType: 'location',
          operation: 'DEACTIVATE',
          effectiveAt: savedChange.effectiveAt,
          targetCompanyId: companyId,
          tenantCode,
        },
        executionTime: savedChange.effectiveAt,
        status: OutboxStatus.PENDING,
      });

      return savedChange;
    });
  }

  private async validateEffectiveDate(
    companyId: string,
    effectiveAt: string,
  ): Promise<{ effectiveAtDate: Date; companyTimezone?: string }> {
    const company = await this.companyRepository.findById(companyId, { required: true });

    if (!isDateString(effectiveAt)) {
      throw new BadRequestException('Invalid effectiveAt date format');
    }

    const effectiveAtDate = new Date(effectiveAt);
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
    locationId: string,
    action: 'updates' | 'deactivation' = 'updates',
  ): Promise<Location> {
    const location = await this.locationRepository.findById(locationId, { required: true });
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
    companyId: string,
    excludeLocationId?: string,
  ): Promise<void> {
    const hasOtherHq = await this.locationRepository.hasActiveOrScheduledHeadquarter(
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
