# Quickstart Guide: Testing & Validating EFFECTIVE_CHANGE_SCHEDULED Consumption

## Prerequisites

- Node.js >= 20.x & pnpm installed
- Docker running (for PostgreSQL & Kafka testcontainers in e2e tests)

## Verification Scenarios

### Scenario 1: Unit Test Consumer & Handler

Run unit tests for the effective-change consumer and service:

```bash
pnpm test src/modules/effective-change/consumers/effective-change.consumer.spec.ts
pnpm test src/modules/effective-change/services/effective-change.service.spec.ts
```

**Expected Outcome**:
- `EffectiveChangeConsumer` correctly receives `setting.effective-change.scheduled` events.
- Valid payloads invoke service method to persist an outbox record with `eventType = 'setting.effective-change.execute'` and `status = 'PENDING'`.
- Duplicate messages (matching Redis key) are ignored.
- Malformed payloads do not throw uncaught errors.

### Scenario 2: Integration / E2E Test with Transactional Outbox

Run the full end-to-end test suite:

```bash
pnpm test:e2e test/effective-change/effective-change-scheduled.e2e-spec.ts
```

**Expected Outcome**:
- Event published to Kafka `setting.effective-change.scheduled` topic is consumed by the Setting Service.
- An `OutboxEventEntity` row is inserted into PostgreSQL with status `PENDING` and payload matching the scheduled change details.
