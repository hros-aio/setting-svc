import { CacheService } from '@new-hros/libs-core';
import { ChangeOperation, EffectiveChangeEventType, EffectiveEntityType } from '../../../enums';
import { EffectiveScheduledEventPayload } from '../dto/effective-scheduled-event.dto';
import { EffectiveChangeService } from '../services/effective-change.service';
import { EffectiveChangeConsumer, ExecuteEventPayload } from './effective-change.consumer';

describe('EffectiveChangeConsumer', () => {
  let consumer: EffectiveChangeConsumer;
  let mockService: {
    scheduleExecution: jest.Mock;
    executeChange: jest.Mock;
  };
  let mockCacheService: {
    has: jest.Mock;
    set: jest.Mock;
  };

  beforeEach(() => {
    mockService = {
      scheduleExecution: jest.fn().mockResolvedValue(undefined),
      executeChange: jest.fn().mockResolvedValue(undefined),
    };
    mockCacheService = {
      has: jest.fn().mockResolvedValue(false),
      set: jest.fn().mockResolvedValue(undefined),
    };

    consumer = new EffectiveChangeConsumer(
      mockService as unknown as EffectiveChangeService,
      mockCacheService as unknown as CacheService,
    );
  });

  describe('handleEffectiveChangeScheduled [US1, US2, US3]', () => {
    const validScheduledEvent: EffectiveScheduledEventPayload = {
      eventId: 'event-uuid-1',
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      timestamp: '2026-08-22T10:00:00Z',
      payload: {
        changeId: 'change-123',
        entityType: EffectiveEntityType.DEPARTMENT,
        operation: ChangeOperation.CREATE,
        effectiveAt: '2026-09-01T00:00:00Z',
        targetCompanyId: 'company-456',
        tenantId: 'tenant-789',
        parameters: { name: 'IT' },
      },
    };

    it('should process valid scheduled event and delegate to scheduleExecution [US1]', async () => {
      await consumer.handleEffectiveChangeScheduled(validScheduledEvent);

      expect(mockCacheService.has).toHaveBeenCalledWith('setting:dedup:event-uuid-1');
      expect(mockCacheService.set).toHaveBeenCalledWith('setting:dedup:event-uuid-1', '1', 86400);
      expect(mockService.scheduleExecution).toHaveBeenCalledWith(validScheduledEvent.payload);
    });

    it('should skip duplicate scheduled events when already cached [US2]', async () => {
      mockCacheService.has.mockResolvedValue(true);

      await consumer.handleEffectiveChangeScheduled(validScheduledEvent);

      expect(mockCacheService.has).toHaveBeenCalledWith('setting:dedup:event-uuid-1');
      expect(mockCacheService.set).not.toHaveBeenCalled();
      expect(mockService.scheduleExecution).not.toHaveBeenCalled();
    });

    it('should skip processing and log warning on malformed payload missing changeId [US3]', async () => {
      const invalidEvent: EffectiveScheduledEventPayload = {
        eventId: 'event-uuid-2',
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        timestamp: '2026-08-22T10:00:00Z',
        payload: {
          changeId: '',
          entityType: EffectiveEntityType.DEPARTMENT,
          operation: ChangeOperation.CREATE,
          effectiveAt: '2026-09-01T00:00:00Z',
          targetCompanyId: 'company-456',
          tenantId: 'tenant-789',
        },
      };

      await consumer.handleEffectiveChangeScheduled(invalidEvent);

      expect(mockService.scheduleExecution).not.toHaveBeenCalled();
    });

    it('should skip processing on malformed payload missing entityType or tenantId [US3]', async () => {
      const invalidEvent = {
        eventId: 'event-uuid-3',
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
        timestamp: '2026-08-22T10:00:00Z',
        payload: {
          changeId: 'change-123',
          entityType: '' as unknown as EffectiveEntityType,
          operation: ChangeOperation.CREATE,
          targetCompanyId: 'comp-1',
          tenantId: '',
        },
      } as unknown as EffectiveScheduledEventPayload;

      await consumer.handleEffectiveChangeScheduled(invalidEvent);

      expect(mockService.scheduleExecution).not.toHaveBeenCalled();
    });
  });

  describe('handleEffectiveChangeExecute', () => {
    const validExecuteEvent: ExecuteEventPayload = {
      eventId: 'exec-event-1',
      eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_EXECUTE,
      timestamp: '2026-08-22T10:00:00Z',
      payload: {
        changeId: 'change-123',
        entityType: EffectiveEntityType.DEPARTMENT,
        operation: ChangeOperation.CREATE,
        tenantId: 'tenant-789',
        companyId: 'company-456',
      },
    };

    it('should process execute event and delegate to executeChange', async () => {
      await consumer.handleEffectiveChangeExecute(validExecuteEvent);

      expect(mockCacheService.has).toHaveBeenCalledWith('setting:dedup:exec-event-1');
      expect(mockService.executeChange).toHaveBeenCalledWith(validExecuteEvent.payload);
    });
  });
});
