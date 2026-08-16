import { EffectiveChangeConsumer } from '../../src/modules/effective-change/consumers/effective-change.consumer';
import { EffectiveChangeService } from '../../src/modules/effective-change/services/effective-change.service';
import { CacheService } from '@new-hros/libs-core';

describe('EffectiveChangeConsumer', () => {
  let consumer: EffectiveChangeConsumer;
  let mockService: jest.Mocked<Partial<EffectiveChangeService>>;
  let mockCacheService: jest.Mocked<Partial<CacheService>>;

  beforeEach(() => {
    mockService = {
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

  it('should process execute event and invoke service', async () => {
    const payload = {
      eventId: 'evt-123',
      eventType: 'setting.effective-change.execute',
      timestamp: new Date().toISOString(),
      payload: {
        changeId: 'loc-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        entityType: 'location',
        operation: 'CREATE',
      },
    };

    await consumer.handleEffectiveChangeExecute(payload);

    expect(mockCacheService.has).toHaveBeenCalledWith('setting:dedup:evt-123');
    expect(mockCacheService.set).toHaveBeenCalledWith('setting:dedup:evt-123', '1', 86400);
    expect(mockService.executeChange).toHaveBeenCalledWith(payload.payload);
  });

  it('should skip duplicate event if cache indicates key exists', async () => {
    (mockCacheService.has as jest.Mock).mockResolvedValue(true);

    const payload = {
      eventId: 'evt-dup',
      eventType: 'setting.effective-change.execute',
      timestamp: new Date().toISOString(),
      payload: {
        changeId: 'loc-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        entityType: 'location',
        operation: 'CREATE',
      },
    };

    await consumer.handleEffectiveChangeExecute(payload);

    expect(mockCacheService.has).toHaveBeenCalledWith('setting:dedup:evt-dup');
    expect(mockCacheService.set).not.toHaveBeenCalled();
    expect(mockService.executeChange).not.toHaveBeenCalled();
  });
});
