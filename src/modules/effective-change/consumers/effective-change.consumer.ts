import { Controller, Logger, Optional } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CacheService } from '@new-hros/libs-core';
import { EffectiveChangeEventType } from '../../../enums';
import { EffectiveScheduledEventPayload } from '../dto/effective-scheduled-event.dto';
import { EffectiveExecuteCommand } from '../handlers/location-apply.handler';
import { EffectiveChangeService } from '../services/effective-change.service';

export interface ExecuteEventPayload {
  eventId: string;
  eventType: string;
  timestamp: string;
  payload: EffectiveExecuteCommand;
}

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
    const command = data?.payload;

    this.logger.log(`Received effective-change.scheduled event: ${eventId}`);

    if (await this.isDuplicateEvent(eventId)) {
      return;
    }

    if (
      !command ||
      !command.changeId ||
      !command.entityType ||
      !command.operation ||
      !command.targetCompanyId ||
      !command.tenantId
    ) {
      this.logger.warn(`Malformed scheduled event payload: ${JSON.stringify(data)}`);
      return;
    }

    await this.effectiveChangeService.scheduleExecution(command);
  }

  @EventPattern(EffectiveChangeEventType.EFFECTIVE_CHANGE_EXECUTE)
  async handleEffectiveChangeExecute(@Payload() data: ExecuteEventPayload): Promise<void> {
    const eventId = data?.eventId;
    const command = data?.payload;

    this.logger.log(`Received effective-change.execute event: ${eventId}`);

    if (await this.isDuplicateEvent(eventId)) {
      return;
    }

    if (!command || !command.changeId || !command.entityType) {
      this.logger.warn(`Malformed execute event payload: ${JSON.stringify(data)}`);
      return;
    }

    await this.effectiveChangeService.executeChange(command);
  }
}
