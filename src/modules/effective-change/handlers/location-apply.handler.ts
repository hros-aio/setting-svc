import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Location } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../entities/effective-change.entity';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import {
  AggregateType,
  EffectiveChangeStatus,
  LocationEventType,
  MasterDataStatus,
  OutboxStatus,
} from '../../../enums';

export interface EffectiveExecuteCommand {
  changeId: string;
  tenantId: string;
  companyId: string;
  entityType: string;
  operation: string;
}

@Injectable()
export class LocationApplyHandler {
  private readonly logger = new Logger(LocationApplyHandler.name);

  constructor(private readonly dataSource: DataSource) {}

  async apply(command: EffectiveExecuteCommand, manager?: EntityManager): Promise<void> {
    const em = manager || this.dataSource.manager;

    const op = command.operation.toUpperCase();

    if (op === 'CREATE') {
      await this.applyCreate(command, em);
    } else if (op === 'UPDATE') {
      await this.applyUpdate(command, em);
    } else if (op === 'DEACTIVATE') {
      await this.applyDeactivate(command, em);
    } else {
      this.logger.warn(
        `Unsupported operation: ${command.operation} for location ${command.changeId}`,
      );
    }
  }

  private async applyCreate(command: EffectiveExecuteCommand, em: EntityManager): Promise<void> {
    const locationRepo = em.getRepository(Location);
    const location = await locationRepo.findOne({
      where: {
        id: command.changeId,
        tenantId: command.tenantId,
        companyId: command.companyId,
      },
    });

    if (!location) {
      this.logger.warn(`Location not found for CREATE apply: ${command.changeId}`);
      return;
    }

    if (location.status === MasterDataStatus.ACTIVE) {
      this.logger.log(`Location ${command.changeId} is already ACTIVE. Idempotent skip.`);
      return;
    }

    location.status = MasterDataStatus.ACTIVE;
    await locationRepo.save(location);

    // Emit domain event setting.location.created
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.LOCATION,
      aggregateId: location.id,
      eventType: LocationEventType.LOCATION_CREATED,
      payload: {
        locationId: location.id,
        tenantId: location.tenantId,
        companyId: location.companyId,
        code: location.code,
        name: location.name,
        countryCode: location.countryCode,
        timezone: location.timezone,
        isHeadquarter: location.isHeadquarter,
        status: location.status,
        effectiveAt: location.effectiveAt,
      },
      executionTime: new Date(),
        status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);
    this.logger.log(`Successfully applied CREATE for Location ${location.id}`);
  }

  private async applyUpdate(command: EffectiveExecuteCommand, em: EntityManager): Promise<void> {
    const changeRepo = em.getRepository(EffectiveChangeEntity);
    const change = await changeRepo.findOne({
      where: {
        id: command.changeId,
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!change) {
      this.logger.warn(`Effective change not found: ${command.changeId}`);
      return;
    }

    if (
      change.status === EffectiveChangeStatus.APPLIED ||
      change.status === EffectiveChangeStatus.CANCELLED
    ) {
      this.logger.log(
        `Effective change ${command.changeId} is already in ${change.status} state. Skip.`,
      );
      return;
    }

    const locationRepo = em.getRepository(Location);
    const location = await locationRepo.findOne({
      where: {
        id: change.entityId,
        tenantId: change.tenantId,
        companyId: change.companyId,
      },
    });

    if (!location) {
      change.status = EffectiveChangeStatus.FAILED;
      change.errorMessage = `Target location ${change.entityId} not found`;
      await changeRepo.save(change);
      return;
    }

    change.status = EffectiveChangeStatus.APPLIED;
    change.processedAt = new Date();
    await changeRepo.save(change);

    // Emit domain event setting.location.updated
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.LOCATION,
      aggregateId: location.id,
      eventType: LocationEventType.LOCATION_UPDATED,
      payload: {
        locationId: location.id,
        tenantId: location.tenantId,
        companyId: location.companyId,
        code: location.code,
        name: location.name,
        countryCode: location.countryCode,
        timezone: location.timezone,
        isHeadquarter: location.isHeadquarter,
        status: location.status,
        updatedFields: change.payload,
      },
      executionTime: new Date(),
        status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);
    this.logger.log(`Successfully applied UPDATE for Location ${location.id}`);
  }

  private async applyDeactivate(
    command: EffectiveExecuteCommand,
    em: EntityManager,
  ): Promise<void> {
    const changeRepo = em.getRepository(EffectiveChangeEntity);
    const change = await changeRepo.findOne({
      where: {
        id: command.changeId,
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!change) {
      this.logger.warn(`Effective change not found: ${command.changeId}`);
      return;
    }

    if (
      change.status === EffectiveChangeStatus.APPLIED ||
      change.status === EffectiveChangeStatus.CANCELLED
    ) {
      return;
    }

    const locationRepo = em.getRepository(Location);
    const location = await locationRepo.findOne({
      where: {
        id: change.entityId,
        tenantId: change.tenantId,
        companyId: change.companyId,
      },
    });

    if (!location) {
      change.status = EffectiveChangeStatus.FAILED;
      change.errorMessage = `Target location ${change.entityId} not found`;
      await changeRepo.save(change);
      return;
    }

    location.status = MasterDataStatus.INACTIVE;
    await locationRepo.save(location);

    change.status = EffectiveChangeStatus.APPLIED;
    change.processedAt = new Date();
    await changeRepo.save(change);

    // Emit domain event setting.location.deactivated
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.LOCATION,
      aggregateId: location.id,
      eventType: LocationEventType.LOCATION_DEACTIVATED,
      payload: {
        locationId: location.id,
        tenantId: location.tenantId,
        companyId: location.companyId,
        code: location.code,
        status: location.status,
      },
      executionTime: new Date(),
        status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);
    this.logger.log(`Successfully applied DEACTIVATE for Location ${location.id}`);
  }
}
