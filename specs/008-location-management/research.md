# Technical Research: Location Management

## Overview

This research document consolidates architectural decisions, integration patterns, and best practices for implementing Location Management within `setting-svc`.

---

## 1. Effective Date Validation & Timezone Resolution

### Decision
Calculate the "end of current business day" cutoff relative to the Company's timezone (`companies.timezone`). If the company timezone is unset or invalid, fallback safely to `UTC`.
The cutoff timestamp is defined as `23:59:59.999` in the respective timezone on the current day. Any requested `effectiveAt` must be strictly $\ge$ this cutoff.

### Rationale
- Aligns with PRD BR-10 and AC-7 where business changes take effect from the start of the next business day onwards.
- Using the Company's configured timezone prevents premature or delayed activation across global multi-timezone deployments.

### Alternatives Considered
- *Strict UTC everywhere*: Rejected because end of business day in Asia/Tokyo is 9 hours ahead of UTC, causing unexpected rejection/acceptance windows for local administrators.
- *Client-supplied timezone*: Rejected because client clocks and timezones can be manipulated; server-side company master timezone is authoritative.

---

## 2. Headquarter Uniqueness & Schema Constraints

### Decision
Enforce single headquarter designation per company using a two-tier strategy:
1. **Application-level validation**: In `LocationService.createLocation` / `updateLocation`, query for existing active or scheduled locations with `isHeadquarter = true`. Reject with friendly `HeadquarterAlreadyAssignedError` before attempting DB insert.
2. **Database partial unique index**: `uq_locations_one_headquarter_per_company` on `(company_id)` WHERE `is_headquarter = true AND status <> 'inactive'`.

### Rationale
- Guarantees data integrity at the database level even under concurrent write race conditions.
- Excluding `status = 'inactive'` allows a new headquarter to be created or designated after a previous headquarter has been deactivated.

### Alternatives Considered
- *Simple unique constraint on `(company_id, is_headquarter)`*: Rejected because companies will have multiple non-headquarter locations (`is_headquarter = false`).
- *Application-only validation*: Rejected because concurrent requests could bypass checks and result in duplicate active headquarters.

---

## 3. Atomic Outbox & Asynchronous Execution Flow

### Decision
Implement the Transactional Outbox pattern within the same PostgreSQL transaction for all scheduling operations:
- For `CreateLocation`: insert `locations` (`scheduled`) + update `company_setup_steps` (`LOCATION` $\to$ `COMPLETED` if first) + insert `outbox_events` (`setting.effective-change.scheduled`).
- For `UpdateLocation` / `DeactivateLocation`: insert `effective_changes` (`scheduled`) + insert `outbox_events` (`setting.effective-change.scheduled`).
- Consumer for `setting.effective-change.execute` uses Redis `SETNX setting:dedup:{eventId} EX 86400` and executes within a PostgreSQL transaction with optimistic locking (`expected_updated_at`).

### Rationale
- Zero distributed transaction dual-write inconsistency between DB and Kafka.
- Strict polyrepo boundary: Go worker schedules with Asynq without ever connecting directly to PostgreSQL.
- Idempotent execution prevents duplicate state mutations.

### Alternatives Considered
- *Direct synchronous cron in NestJS*: Rejected due to lack of distributed coordination across multiple pod replicas and poor scaling.
- *Go worker mutating PostgreSQL directly*: Violates Constitution Principle II (Polyrepo Architecture & Cross-Service Contracts).

---

## 4. Single Pending Change Rule & Optimistic Concurrency

### Decision
Enforce invariant `INV-007` (at most one pending scheduled change per entity) by checking `effective_changes` for existing records with `entity_type = 'location'`, `entity_id = locationId`, and `status = 'scheduled'`.
During execution, compare `locations.updated_at` against `effective_changes.expected_updated_at`. If drift is detected, transition `effective_changes.status = 'conflict'` and emit notification.

### Rationale
- Prevents conflicting intermediate mutations from overriding newer operational data.
- Gives administrators clear conflict feedback rather than silently applying stale deltas.

---

## 5. Summary of Architecture Decisions

| Area | Decision | Reference |
|---|---|---|
| Domain Authority | Setting Service exclusively owns `locations` & `effective_changes` tables | ADR-6, ADR-8, Constitution II |
| Effective Dating | $\ge$ End of day in Company timezone | PRD BR-10, AC-7 |
| Headquarter Rule | Partial unique index on `(company_id) WHERE is_headquarter = true AND status <> 'inactive'` | System Architecture §10.1 |
| Setup Tracking | Auto-complete `LOCATION` step in `company_setup_steps` on first location | PRD FR-16 |
| Event Publishing | Transactional Outbox $\to$ Kafka topic `setting.effective-change.scheduled` | System Architecture §7 |
