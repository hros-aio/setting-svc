import { Controller, Logger, Optional } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CacheService } from '@new-hros/libs-core';
import { ChangeOperation, EffectiveChangeEventType, EffectiveEntityType } from '../../../enums';
import { EffectiveScheduledEventPayload } from '../dto/effective-scheduled-event.dto';
import { EffectiveExecuteCommand } from '../handlers/location-apply.handler';
import { EffectiveChangeService } from '../services/effective-change.service';

export interface ExecuteEventPayload {
  eventId: string;
  eventType: string;
  timestamp: string;
  payload: EffectiveExecuteCommand;
}

const VALID_ENTITY_TYPES = new Set(Object.values(EffectiveEntityType));
const VALID_OPERATIONS = new Set(Object.values(ChangeOperation));

@Controller()
export class EffectiveChangeConsumer {
  private readonly logger = new Logger(EffectiveChangeConsumer.name);

  constructor(
    private readonly effectiveChangeService: EffectiveChangeService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Checks Redis/L2 cache for duplicate eventId.
   * If seen, returns true (is duplicate).
   * If not seen, sets the key with 24h TTL and returns false.
   */
  private async isDuplicateEvent(eventId?: string): Promise<boolean> {
    if (!this.cacheService || !eventId) {
      return false;
    }

    const dedupKey = `setting:dedup:${eventId}`;
    try {
      const exists = await this.cacheService.has(dedupKey);
      if (exists) {
        this.logger.log(
          `Duplicate event ${eventId} detected in cache. Acknowledging and skipping.`,
        );
        return true;
      }
      await this.cacheService.set(dedupKey, '1', 86400);
      return false;
    } catch (err) {
      this.logger.warn(`Cache deduplication check failed: ${(err as Error).message}`);
      return false;
    }
  }

  @EventPattern(EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED)
  async handleEffectiveChangeScheduled(
    @Payload() data: EffectiveScheduledEventPayload,
  ): Promise<void> {
    const eventId = data?.eventId;

    // Runtime validation of eventId before deduplication
    if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
      this.logger.warn(
        JSON.stringify({
          message: 'Malformed scheduled event missing eventId',
          eventType: data?.eventType,
        }),
      );
      return;
    }

    if (await this.isDuplicateEvent(eventId)) {
      return;
    }

    const command = data?.payload;
    if (!command) {
      this.logger.warn(
        JSON.stringify({
          message: 'Malformed scheduled event missing payload',
          eventId,
        }),
      );
      return;
    }

    const { changeId, entityType, operation, effectiveAt, targetCompanyId, tenantId } = command;

    const isEffectiveAtValid =
      effectiveAt &&
      (typeof effectiveAt === 'string' || effectiveAt instanceof Date) &&
      !isNaN(new Date(effectiveAt).getTime());

    const opUpper = (operation as string).toUpperCase();
    const opLower = (operation as string).toLowerCase();
    const isValidOp =
      VALID_OPERATIONS.has(opLower as ChangeOperation) ||
      VALID_OPERATIONS.has(opUpper as ChangeOperation) ||
      opUpper === 'CREATE' ||
      opUpper === 'UPDATE' ||
      opUpper === 'DEACTIVATE' ||
      opUpper === 'DELETE' ||
      opUpper === 'TRANSFER';

    if (
      !changeId ||
      !entityType ||
      !operation ||
      !targetCompanyId ||
      !tenantId ||
      !isEffectiveAtValid ||
      !VALID_ENTITY_TYPES.has(entityType.toLowerCase() as EffectiveEntityType) ||
      !isValidOp
    ) {
      this.logger.warn(
        JSON.stringify({
          message: 'Malformed scheduled event payload',
          eventId,
          changeId: changeId || null,
          entityType: entityType || null,
          operation: operation || null,
          targetCompanyId: targetCompanyId || null,
          tenantId: tenantId || null,
        }),
      );
      return;
    }

    this.logger.log(
      JSON.stringify({
        message: 'Processing effective-change.scheduled event',
        eventId,
        changeId,
        entityType,
        operation,
        targetCompanyId,
        tenantId,
      }),
    );

    await this.effectiveChangeService.scheduleExecution(command);
  }

  @EventPattern(EffectiveChangeEventType.EFFECTIVE_CHANGE_EXECUTE)
  async handleEffectiveChangeExecute(@Payload() data: ExecuteEventPayload): Promise<void> {
    const eventId = data?.eventId;

    if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
      this.logger.warn(
        JSON.stringify({
          message: 'Malformed execute event missing eventId',
          eventType: data?.eventType,
        }),
      );
      return;
    }

    if (await this.isDuplicateEvent(eventId)) {
      return;
    }

    const command = data?.payload;
    if (!command || !command.changeId || !command.entityType) {
      this.logger.warn(
        JSON.stringify({
          message: 'Malformed execute event payload',
          eventId,
          changeId: command?.changeId || null,
          entityType: command?.entityType || null,
          tenantId: command?.tenantId || null,
        }),
      );
      return;
    }

    this.logger.log(
      JSON.stringify({
        message: 'Processing effective-change.execute event',
        eventId,
        changeId: command.changeId,
        entityType: command.entityType,
        tenantId: command.tenantId,
      }),
    );

    await this.effectiveChangeService.executeChange(command);
  }
}
