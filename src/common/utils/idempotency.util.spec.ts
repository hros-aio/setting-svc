import { buildIdempotencyKey } from './idempotency.util';

describe('buildIdempotencyKey', () => {
  it('should generate standardized idempotency key for company', () => {
    const key = buildIdempotencyKey('tenant-123', 'idemp-456', 'company');
    expect(key).toBe('idempotency:company:tenant-123:idemp-456');
  });

  it('should default resourceType to company', () => {
    const key = buildIdempotencyKey('tenant-123', 'idemp-456');
    expect(key).toBe('idempotency:company:tenant-123:idemp-456');
  });

  it('should return null if idempotencyKey is null, undefined, or empty', () => {
    expect(buildIdempotencyKey('tenant-123', null)).toBeNull();
    expect(buildIdempotencyKey('tenant-123', undefined)).toBeNull();
    expect(buildIdempotencyKey('tenant-123', '')).toBeNull();
    expect(buildIdempotencyKey('tenant-123', '   ')).toBeNull();
  });
});
