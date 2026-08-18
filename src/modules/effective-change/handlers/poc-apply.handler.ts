import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AggregateType,
  EffectiveChangeStatus,
  MasterDataStatus,
  OutboxStatus,
  PocEventType,
} from '../../../enums';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { PocEntity } from '../../poc/entities/poc.entity';
import { EffectiveChangeEntity } from '../entities/effective-change.entity';
import { EffectiveExecuteCommand } from './location-apply.handler';

@Injectable()
export class PocApplyHandler {
  private readonly logger = new Logger(PocApplyHandler.name);

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
        `Unsupported operation: ${command.operation} for Point of Contact ${command.changeId}`,
      );
    }
  }

  private async applyCreate(command: EffectiveExecuteCommand, em: EntityManager): Promise<void> {
    const pocRepo = em.getRepository(PocEntity);
    const poc = await pocRepo.findOne({
      where: {
        id: command.changeId,
        tenantId: command.tenantId,
        companyId: command.companyId,
      },
    });

    if (!poc) {
      this.logger.warn(`Point of Contact not found for CREATE apply: ${command.changeId}`);
      return;
    }

    if (poc.status === MasterDataStatus.ACTIVE) {
      this.logger.log(`Point of Contact ${command.changeId} is already ACTIVE. Idempotent skip.`);
      return;
    }

    poc.status = MasterDataStatus.ACTIVE;
    await pocRepo.save(poc);

    // Emit domain event setting.poc.assigned
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.POC,
      aggregateId: poc.id,
      eventType: PocEventType.POC_ASSIGNED,
      payload: {
        pocId: poc.id,
        tenantId: poc.tenantId,
        companyId: poc.companyId,
        pocType: poc.pocType,
        employeeId: poc.employeeId,
        status: poc.status,
        effectiveAt: poc.effectiveAt,
      },
      status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);

    this.logger.log(`Successfully applied CREATE for Point of Contact ${poc.id}`);
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

    const pocRepo = em.getRepository(PocEntity);
    const previousPoc = await pocRepo.findOne({
      where: {
        id: change.entityId,
        tenantId: change.tenantId,
        companyId: change.companyId,
      },
    });

    if (!previousPoc) {
      change.status = EffectiveChangeStatus.FAILED;
      change.errorMessage = `Target Point of Contact ${change.entityId} not found`;
      await changeRepo.save(change);
      return;
    }

    const payload = change.payload || {};
    const newEmployeeId = payload.newEmployeeId as string;

    if (!newEmployeeId) {
      change.status = EffectiveChangeStatus.FAILED;
      change.errorMessage = `Missing newEmployeeId in change payload`;
      await changeRepo.save(change);
      return;
    }

    // 1. Archive prior active PoC
    previousPoc.status = MasterDataStatus.INACTIVE;
    await pocRepo.save(previousPoc);

    // 2. Create new active PoC
    const newPoc = pocRepo.create({
      tenantId: change.tenantId,
      companyId: change.companyId,
      pocType: previousPoc.pocType,
      employeeId: newEmployeeId,
      status: MasterDataStatus.ACTIVE,
      effectiveAt: change.effectiveAt,
      createdBy: change.createdBy,
      updatedBy: change.createdBy,
    });
    const savedNewPoc = await pocRepo.save(newPoc);

    // 3. Mark effective change applied
    change.status = EffectiveChangeStatus.APPLIED;
    change.processedAt = new Date();
    await changeRepo.save(change);

    // 4. Emit domain event setting.poc.replaced
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.POC,
      aggregateId: savedNewPoc.id,
      eventType: PocEventType.POC_REPLACED,
      payload: {
        previousPocId: previousPoc.id,
        newPocId: savedNewPoc.id,
        tenantId: change.tenantId,
        companyId: change.companyId,
        pocType: previousPoc.pocType,
        previousEmployeeId: previousPoc.employeeId,
        newEmployeeId: savedNewPoc.employeeId,
        effectiveAt: change.effectiveAt,
      },
      status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);

    this.logger.log(
      `Successfully applied replacement for PoC ${previousPoc.id} -> ${savedNewPoc.id}`,
    );
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
      this.logger.log(
        `Effective change ${command.changeId} is already in ${change.status} state. Skip.`,
      );
      return;
    }

    const pocRepo = em.getRepository(PocEntity);
    const poc = await pocRepo.findOne({
      where: {
        id: change.entityId,
        tenantId: change.tenantId,
        companyId: change.companyId,
      },
    });

    if (!poc) {
      change.status = EffectiveChangeStatus.FAILED;
      change.errorMessage = `Target Point of Contact ${change.entityId} not found`;
      await changeRepo.save(change);
      return;
    }

    poc.status = MasterDataStatus.INACTIVE;
    await pocRepo.save(poc);

    change.status = EffectiveChangeStatus.APPLIED;
    change.processedAt = new Date();
    await changeRepo.save(change);

    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.POC,
      aggregateId: poc.id,
      eventType: PocEventType.POC_DEACTIVATED,
      payload: {
        pocId: poc.id,
        tenantId: poc.tenantId,
        companyId: poc.companyId,
        pocType: poc.pocType,
        employeeId: poc.employeeId,
        effectiveAt: change.effectiveAt,
      },
      status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);

    this.logger.log(`Successfully applied DEACTIVATE for Point of Contact ${poc.id}`);
  }
}
