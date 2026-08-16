import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { GradeEntity } from '../../grade/entities/grade.entity';
import { EffectiveChangeEntity } from '../entities/effective-change.entity';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import {
  AggregateType,
  GradeEventType,
  EffectiveChangeStatus,
  MasterDataStatus,
  OutboxStatus,
} from '../../../enums';
import { EffectiveExecuteCommand } from './location-apply.handler';

@Injectable()
export class GradeApplyHandler {
  private readonly logger = new Logger(GradeApplyHandler.name);

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
      this.logger.warn(`Unsupported operation: ${command.operation} for grade ${command.changeId}`);
    }
  }

  private async applyCreate(command: EffectiveExecuteCommand, em: EntityManager): Promise<void> {
    const gradeRepo = em.getRepository(GradeEntity);
    const grade = await gradeRepo.findOne({
      where: {
        id: command.changeId,
        tenantId: command.tenantId,
        companyId: command.companyId,
      },
    });

    if (!grade) {
      this.logger.warn(`Grade not found for CREATE apply: ${command.changeId}`);
      return;
    }

    if (grade.status === MasterDataStatus.ACTIVE) {
      this.logger.log(`Grade ${command.changeId} is already ACTIVE. Idempotent skip.`);
      return;
    }

    grade.status = MasterDataStatus.ACTIVE;
    await gradeRepo.save(grade);

    // Emit domain event setting.grade.created
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.GRADE,
      aggregateId: grade.id,
      eventType: GradeEventType.GRADE_CREATED,
      payload: {
        gradeId: grade.id,
        tenantId: grade.tenantId,
        companyId: grade.companyId,
        code: grade.code,
        name: grade.name,
        description: grade.description,
        rankOrder: grade.rankOrder,
        status: grade.status,
        effectiveAt: grade.effectiveAt,
      },
      status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);
    this.logger.log(`Successfully applied CREATE for Grade ${grade.id}`);
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

    const gradeRepo = em.getRepository(GradeEntity);
    const grade = await gradeRepo.findOne({
      where: {
        id: change.entityId,
        tenantId: change.tenantId,
        companyId: change.companyId,
      },
    });

    if (!grade) {
      change.status = EffectiveChangeStatus.FAILED;
      change.errorMessage = `Target grade ${change.entityId} not found`;
      await changeRepo.save(change);
      return;
    }

    const payload = change.payload || {};
    if (payload.name !== undefined) grade.name = payload.name as string;
    if (payload.code !== undefined) grade.code = payload.code as string;
    if (payload.description !== undefined) grade.description = payload.description as string;
    if (payload.rankOrder !== undefined) {
      grade.rankOrder = (payload.rankOrder as number | null) ?? undefined;
    }

    await gradeRepo.save(grade);

    change.status = EffectiveChangeStatus.APPLIED;
    change.processedAt = new Date();
    await changeRepo.save(change);

    // Emit domain event setting.grade.updated
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.GRADE,
      aggregateId: grade.id,
      eventType: GradeEventType.GRADE_UPDATED,
      payload: {
        gradeId: grade.id,
        tenantId: grade.tenantId,
        companyId: grade.companyId,
        code: grade.code,
        name: grade.name,
        description: grade.description,
        rankOrder: grade.rankOrder,
        status: grade.status,
        updatedFields: change.payload,
      },
      status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);
    this.logger.log(`Successfully applied UPDATE for Grade ${grade.id}`);
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

    const gradeRepo = em.getRepository(GradeEntity);
    const grade = await gradeRepo.findOne({
      where: {
        id: change.entityId,
        tenantId: change.tenantId,
        companyId: change.companyId,
      },
    });

    if (!grade) {
      change.status = EffectiveChangeStatus.FAILED;
      change.errorMessage = `Target grade ${change.entityId} not found`;
      await changeRepo.save(change);
      return;
    }

    grade.status = MasterDataStatus.INACTIVE;
    await gradeRepo.save(grade);

    change.status = EffectiveChangeStatus.APPLIED;
    change.processedAt = new Date();
    await changeRepo.save(change);

    // Emit domain event setting.grade.deactivated
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.GRADE,
      aggregateId: grade.id,
      eventType: GradeEventType.GRADE_DEACTIVATED,
      payload: {
        gradeId: grade.id,
        tenantId: grade.tenantId,
        companyId: grade.companyId,
        code: grade.code,
        status: grade.status,
      },
      status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);
    this.logger.log(`Successfully applied DEACTIVATE for Grade ${grade.id}`);
  }
}
