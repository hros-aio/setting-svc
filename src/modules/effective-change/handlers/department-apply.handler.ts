import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Department } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../entities/effective-change.entity';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import {
  AggregateType,
  DepartmentEventType,
  EffectiveChangeStatus,
  MasterDataStatus,
  OutboxStatus,
} from '../../../enums';
import { EffectiveExecuteCommand } from './location-apply.handler';

@Injectable()
export class DepartmentApplyHandler {
  private readonly logger = new Logger(DepartmentApplyHandler.name);

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
        `Unsupported operation: ${command.operation} for department ${command.changeId}`,
      );
    }
  }

  private async applyCreate(command: EffectiveExecuteCommand, em: EntityManager): Promise<void> {
    const departmentRepo = em.getRepository(Department);
    const department = await departmentRepo.findOne({
      where: {
        id: command.changeId,
        tenantId: command.tenantId,
        companyId: command.companyId,
      },
    });

    if (!department) {
      this.logger.warn(`Department not found for CREATE apply: ${command.changeId}`);
      return;
    }

    if (department.status === MasterDataStatus.ACTIVE) {
      this.logger.log(`Department ${command.changeId} is already ACTIVE. Idempotent skip.`);
      return;
    }

    department.status = MasterDataStatus.ACTIVE;
    await departmentRepo.save(department);

    // Emit domain event setting.department.created
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.DEPARTMENT,
      aggregateId: department.id,
      eventType: DepartmentEventType.DEPARTMENT_CREATED,
      payload: {
        departmentId: department.id,
        tenantId: department.tenantId,
        companyId: department.companyId,
        code: department.code,
        name: department.name,
        description: department.description,
        parentDepartmentId: department.parentDepartmentId,
        status: department.status,
        effectiveAt: department.effectiveAt,
      },
      executionTime: new Date(),
      status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);
    this.logger.log(`Successfully applied CREATE for Department ${department.id}`);
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

    const departmentRepo = em.getRepository(Department);
    const department = await departmentRepo.findOne({
      where: {
        id: change.entityId,
        tenantId: change.tenantId,
        companyId: change.companyId,
      },
    });

    if (!department) {
      change.status = EffectiveChangeStatus.FAILED;
      change.errorMessage = `Target department ${change.entityId} not found`;
      await changeRepo.save(change);
      return;
    }

    const payload = change.payload || {};
    if (payload.name !== undefined) department.name = payload.name as string;
    if (payload.code !== undefined) department.code = payload.code as string;
    if (payload.description !== undefined) department.description = payload.description as string;
    if (payload.parentDepartmentId !== undefined) {
      const parentId = payload.parentDepartmentId as string | null;
      if (parentId) {
        const parent = await departmentRepo.findOne({
          where: {
            id: parentId,
            tenantId: change.tenantId,
            companyId: change.companyId,
          },
        });
        if (!parent || parent.status === MasterDataStatus.INACTIVE) {
          change.status = EffectiveChangeStatus.CONFLICT;
          change.errorMessage = `Parent department ${parentId} is invalid or inactive`;
          await changeRepo.save(change);
          return;
        }
      }
      department.parentDepartmentId = parentId || undefined;
    }

    await departmentRepo.save(department);

    change.status = EffectiveChangeStatus.APPLIED;
    change.processedAt = new Date();
    await changeRepo.save(change);

    // Emit domain event setting.department.updated
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.DEPARTMENT,
      aggregateId: department.id,
      eventType: DepartmentEventType.DEPARTMENT_UPDATED,
      payload: {
        departmentId: department.id,
        tenantId: department.tenantId,
        companyId: department.companyId,
        code: department.code,
        name: department.name,
        description: department.description,
        parentDepartmentId: department.parentDepartmentId,
        status: department.status,
        updatedFields: change.payload,
      },
      executionTime: new Date(),
      status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);
    this.logger.log(`Successfully applied UPDATE for Department ${department.id}`);
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

    const departmentRepo = em.getRepository(Department);
    const department = await departmentRepo.findOne({
      where: {
        id: change.entityId,
        tenantId: change.tenantId,
        companyId: change.companyId,
      },
    });

    if (!department) {
      change.status = EffectiveChangeStatus.FAILED;
      change.errorMessage = `Target department ${change.entityId} not found`;
      await changeRepo.save(change);
      return;
    }

    department.status = MasterDataStatus.INACTIVE;
    await departmentRepo.save(department);

    change.status = EffectiveChangeStatus.APPLIED;
    change.processedAt = new Date();
    await changeRepo.save(change);

    // Emit domain event setting.department.deactivated
    const outboxRepo = em.getRepository(OutboxEventEntity);
    const domainEvent = outboxRepo.create({
      aggregateType: AggregateType.DEPARTMENT,
      aggregateId: department.id,
      eventType: DepartmentEventType.DEPARTMENT_DEACTIVATED,
      payload: {
        departmentId: department.id,
        tenantId: department.tenantId,
        companyId: department.companyId,
        code: department.code,
        status: department.status,
      },
      executionTime: new Date(),
      status: OutboxStatus.PENDING,
    });
    await outboxRepo.save(domainEvent);
    this.logger.log(`Successfully applied DEACTIVATE for Department ${department.id}`);
  }
}
