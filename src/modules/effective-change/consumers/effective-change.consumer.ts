import { Controller, Logger, Optional } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CacheService } from '@new-hros/libs-core';
import { EffectiveChangeEventType } from '../../../enums';
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

  @EventPattern(EffectiveChangeEventType.EFFECTIVE_CHANGE_EXECUTE)
  async handleEffectiveChangeExecute(@Payload() data: ExecuteEventPayload): Promise<void> {
    const eventId = data?.eventId;
    const command = data?.payload;

    this.logger.log(`Received effective-change.execute event: ${eventId}`);

    // Redis / L2 Cache deduplication (24h TTL = 86400s)
    if (this.cacheService && eventId) {
      const dedupKey = `setting:dedup:${eventId}`;
      try {
        const exists = await this.cacheService.has(dedupKey);
        if (exists) {
          this.logger.log(
            `Duplicate event ${eventId} detected in cache. Acknowledging and skipping.`,
          );
          return;
        }
        await this.cacheService.set(dedupKey, '1', 86400);
      } catch (err) {
        this.logger.warn(`Cache deduplication check failed: ${(err as Error).message}`);
      }
    }

    if (!command || !command.changeId || !command.entityType) {
      this.logger.warn(`Malformed execute event payload: ${JSON.stringify(data)}`);
      return;
    }

    await this.effectiveChangeService.executeChange(command);
  }
}
