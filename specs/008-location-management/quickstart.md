# Quickstart Guide: Location Management

## Prerequisites
- PostgreSQL running locally or in Docker test container.
- Redis instance available for deduplication.
- Kafka broker running for event integration testing.
- Dependencies installed via `pnpm install`.

## Validation Scenarios

### 1. Database Migration & Entity Constraint Validation
Run migration validation tests ensuring partial unique index for headquarter uniqueness is in place:
```bash
pnpm test src/modules/location/tests/location.entity.spec.ts
```

### 2. Location Creation & Setup Step Completion
Verify that scheduling a new location inserts `locations` with `scheduled` status, writes to outbox, and completes the setup step:
```bash
pnpm test src/modules/location/tests/create-location.spec.ts
```

### 3. Effective Change Scheduling & Optimistic Concurrency
Verify single pending change validation (`409 Conflict` on duplicates) and `effective_changes` scheduling:
```bash
pnpm test src/modules/location/tests/update-location.spec.ts
```

### 4. End-to-End Effective Change Execution & Outbox Delivery
Simulate execution trigger consumption from Go worker and verify master data transition to `active`/`inactive`:
```bash
pnpm test src/modules/effective-change/tests/location-apply.handler.spec.ts
```

### 5. Running Full Test Suite & Linting
```bash
pnpm lint
pnpm test
```
