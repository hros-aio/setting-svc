import { ChangeOperation, EffectiveEntityType } from '../../../enums';

export interface EffectiveScheduledCommand {
  changeId: string;
  entityType: EffectiveEntityType;
  operation: ChangeOperation;
  effectiveAt: string | Date;
  targetCompanyId: string;
  tenantId: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EffectiveScheduledEventPayload {
  eventId: string;
  eventType: string;
  timestamp: string;
  payload: EffectiveScheduledCommand;
}
