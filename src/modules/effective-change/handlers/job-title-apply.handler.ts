import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JobTitleEntity } from '../../job-title/entities/job-title.entity';
import { EffectiveChangeEntity } from '../entities/effective-change.entity';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import {
  AggregateType,
  JobTitleEventType,
  EffectiveChangeStatus,
  MasterDataStatus,
  OutboxStatus,
} from '../../../enums';
import { EffectiveExecuteCommand } from './location-apply.handler';

@Injectable()
export class JobTitleApplyHandler {
  private readonly logger = new Logger(JobTitleApplyHandler.name);

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
        `Unsupported operation: ${command.operation} for job title ${command.changeId}`,
      );
    }
  }

  private async applyCreate(command: EffectiveExecuteCommand, em: EntityManager): Promise<void> {
    const jobTitleRepo = em.getRepository(JobTitleEntity);
    const jobTitle = await jobTitleRepo.findOne({
      where: {
        id: command.changeId,
        tenantId: command.tenantId,
        companyId: command.companyId,
      },
    });

    if (!jobTitle) {
      this.logger.warn(`Job Title not found for CREATE apply: ${command.changeId}`);
      return;
    }

    if (jobTitle.status === MasterDataStatus.ACTIVE) {
      this.logger.log(`Job Title ${command.changeId} is already ACTIVE. Idempotent skip.`);
      return;
    }

    jobTitle.status = MasterDataStatus.ACTIVE;
    await jobTitleRepo.save(jobTitle);

    // Emit domain event setting.job-title.created
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.JOB_TITLE,
      aggregateId: jobTitle.id,
      eventType: JobTitleEventType.JOB_TITLE_CREATED,
      payload: {
        jobTitleId: jobTitle.id,
        tenantId: jobTitle.tenantId,
        companyId: jobTitle.companyId,
        code: jobTitle.code,
        name: jobTitle.name,
        departmentId: jobTitle.departmentId,
        gradeId: jobTitle.gradeId,
        description: jobTitle.description,
        status: jobTitle.status,
        effectiveAt: jobTitle.effectiveAt,
      },
      status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);
    this.logger.log(`Successfully applied CREATE for Job Title ${jobTitle.id}`);
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

    const jobTitleRepo = em.getRepository(JobTitleEntity);
    const jobTitle = await jobTitleRepo.findOne({
      where: {
        id: change.entityId,
        tenantId: change.tenantId,
        companyId: change.companyId,
      },
    });

    if (!jobTitle) {
      change.status = EffectiveChangeStatus.FAILED;
      change.errorMessage = `Target job title ${change.entityId} not found`;
      await changeRepo.save(change);
      return;
    }

    // Optimistic lock check
    if (
      change.expectedUpdatedAt &&
      jobTitle.updatedAt &&
      new Date(change.expectedUpdatedAt).getTime() !== new Date(jobTitle.updatedAt).getTime()
    ) {
      this.logger.warn(
        `Optimistic lock mismatch for job title ${jobTitle.id}. Expected ${change.expectedUpdatedAt}, found ${jobTitle.updatedAt}. Setting status to CONFLICT.`,
      );
      change.status = EffectiveChangeStatus.CONFLICT;
      change.errorMessage = 'Master record updated out-of-band; state mismatch detected';
      await changeRepo.save(change);
      return;
    }

    const payload = change.payload || {};
    if (payload.name !== undefined) jobTitle.name = payload.name as string;
    if (payload.code !== undefined) jobTitle.code = payload.code as string;
    if (payload.description !== undefined) jobTitle.description = payload.description as string;
    if (payload.departmentId !== undefined) jobTitle.departmentId = payload.departmentId as string;
    if (payload.gradeId !== undefined) jobTitle.gradeId = payload.gradeId as string;

    await jobTitleRepo.save(jobTitle);

    change.status = EffectiveChangeStatus.APPLIED;
    change.processedAt = new Date();
    await changeRepo.save(change);

    // Emit domain event setting.job-title.updated
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.JOB_TITLE,
      aggregateId: jobTitle.id,
      eventType: JobTitleEventType.JOB_TITLE_UPDATED,
      payload: {
        jobTitleId: jobTitle.id,
        tenantId: jobTitle.tenantId,
        companyId: jobTitle.companyId,
        code: jobTitle.code,
        name: jobTitle.name,
        departmentId: jobTitle.departmentId,
        gradeId: jobTitle.gradeId,
        description: jobTitle.description,
        status: jobTitle.status,
        updatedFields: change.payload,
      },
      status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);
    this.logger.log(`Successfully applied UPDATE for Job Title ${jobTitle.id}`);
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

    const jobTitleRepo = em.getRepository(JobTitleEntity);
    const jobTitle = await jobTitleRepo.findOne({
      where: {
        id: change.entityId,
        tenantId: change.tenantId,
        companyId: change.companyId,
      },
    });

    if (!jobTitle) {
      change.status = EffectiveChangeStatus.FAILED;
      change.errorMessage = `Target job title ${change.entityId} not found`;
      await changeRepo.save(change);
      return;
    }

    jobTitle.status = MasterDataStatus.INACTIVE;
    await jobTitleRepo.save(jobTitle);

    change.status = EffectiveChangeStatus.APPLIED;
    change.processedAt = new Date();
    await changeRepo.save(change);

    // Emit domain event setting.job-title.deactivated
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.JOB_TITLE,
      aggregateId: jobTitle.id,
      eventType: JobTitleEventType.JOB_TITLE_DEACTIVATED,
      payload: {
        jobTitleId: jobTitle.id,
        tenantId: jobTitle.tenantId,
        companyId: jobTitle.companyId,
        code: jobTitle.code,
        status: jobTitle.status,
      },
      status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);
    this.logger.log(`Successfully applied DEACTIVATE for Job Title ${jobTitle.id}`);
  }
}
