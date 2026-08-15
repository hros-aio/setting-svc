/**
 * Standardized idempotency key generator for caching and deduplication.
 * Format: idempotency:${resourceType}:${tenantId}:${idempotencyKey}
 */
export function buildIdempotencyKey(
  tenantCode: string,
  idempotencyKey?: string | null,
  resourceType: string = 'company',
): string | null {
  if (!idempotencyKey || !idempotencyKey.trim()) {
    return null;
  }
  return `idempotency:${resourceType}:${tenantCode}:${idempotencyKey.trim()}`;
}
