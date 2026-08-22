# Feature Specification: Consume EFFECTIVE_CHANGE_SCHEDULED & Dispatch EFFECTIVE_CHANGE_EXECUTE

**Feature Branch**: `017-consume-effective-change-scheduled`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "In effective-change module will consume EFFECTIVE_CHANGE_SCHEDULED, the handler will receive and create outbox event EFFECTIVE_CHANGE_EXECUTE"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Process Scheduled Effective Changes and Create Execution Events (Priority: P1)

As an asynchronous event handler in the Setting Service, when a scheduled effective change notification (`EFFECTIVE_CHANGE_SCHEDULED`) is received, I need to validate the scheduled change record and persist a corresponding transactional outbox event (`EFFECTIVE_CHANGE_EXECUTE`), so that the downstream execution worker can execute the master data changes at or after the designated effective timestamp.

**Why this priority**: Core integration mechanism between the scheduling pipeline and the execution pipeline for effective-dated entity changes (e.g., location, department, grade, job title, point of contact, employee transfer). Without this handler, scheduled changes cannot transition from scheduled state to execution outbox events.

**Independent Test**: Can be fully tested by sending an `EFFECTIVE_CHANGE_SCHEDULED` event payload to the consumer/handler and asserting that a new outbox event of type `EFFECTIVE_CHANGE_EXECUTE` is created and stored in the transactional outbox table with status `PENDING`.

**Acceptance Scenarios**:

1. **Given** a valid `EFFECTIVE_CHANGE_SCHEDULED` event with changeId, entityType, operation, effectiveAt, targetCompanyId, and tenantId, **When** the event consumer processes the message, **Then** an outbox record with event type `EFFECTIVE_CHANGE_EXECUTE` and aggregate matching the entity type/id is persisted in the database with status `PENDING`.
2. **Given** the effective change record exists in scheduled status, **When** the execute outbox event is created, **Then** the outbox payload preserves the required execution parameters (`changeId`, `entityType`, `operation`, `effectiveAt`, `targetCompanyId`, `tenantId`, and optional `parameters`).

---

### User Story 2 - Duplicate Event Handling & Idempotency (Priority: P2)

As a resilient event consumer, when duplicate `EFFECTIVE_CHANGE_SCHEDULED` messages are received due to network retries or message redelivery, I need to recognize previously processed events and skip duplicate outbox insertion without throwing an unhandled error.

**Why this priority**: Prevents duplicate execution events and ensures idempotency in asynchronous event processing.

**Independent Test**: Can be tested by publishing the same event ID twice and verifying that only one outbox record is persisted, while the second delivery is acknowledged and safely ignored.

**Acceptance Scenarios**:

1. **Given** an `EFFECTIVE_CHANGE_SCHEDULED` event that has already been processed within the deduplication window, **When** the duplicate event is received, **Then** the handler logs the duplicate detection and ignores the duplicate without creating redundant outbox events.

---

### User Story 3 - Malformed & Invalid Payload Handling (Priority: P3)

As a secure event consumer, when a malformed or incomplete `EFFECTIVE_CHANGE_SCHEDULED` message is received (e.g., missing tenantId, changeId, or entityType), I need to log structured warnings and reject/skip invalid processing gracefully without crashing the consumer.

**Why this priority**: Protects data integrity and prevents malformed events from creating invalid outbox entries.

**Independent Test**: Can be tested by providing an event payload missing mandatory fields (`changeId`, `entityType`, or `tenantId`) and asserting that no outbox entry is created and structured warning logs are emitted.

**Acceptance Scenarios**:

1. **Given** a message missing mandatory fields (e.g., missing `changeId` or `entityType`), **When** the handler receives the message, **Then** no outbox event is written and a warning is logged.

---

### Edge Cases

- **Missing or non-existent change entity**: If the `changeId` specified in the scheduled event does not correspond to a valid change record or target entity, the handler logs an error/warning and skips creating an execution outbox event to avoid orphaned execution commands.
- **Cancelled or already executed change**: If the underlying change record has already been cancelled or already executed prior to processing the schedule event, the handler skips creating redundant `EFFECTIVE_CHANGE_EXECUTE` outbox entries.
- **Concurrent duplicate delivery**: If identical events arrive concurrently across distributed service instances, distributed deduplication / database constraints ensure only a single `EFFECTIVE_CHANGE_EXECUTE` outbox record is persisted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST consume `EFFECTIVE_CHANGE_SCHEDULED` events in the `effective-change` module.
- **FR-002**: The consumer handler MUST validate incoming event payloads for required fields (`changeId`, `entityType`, `operation`, `tenantId`, `targetCompanyId`, `effectiveAt`).
- **FR-003**: The consumer handler MUST implement deduplication using event ID caching / idempotency checks before persisting outbox events.
- **FR-004**: Upon successful validation, the system MUST persist an outbox event of type `EFFECTIVE_CHANGE_EXECUTE` (`setting.effective-change.execute`) into the transactional outbox table (`outbox_events`).
- **FR-005**: The created `EFFECTIVE_CHANGE_EXECUTE` outbox event MUST include the aggregate type, aggregate ID, payload containing change execution details, tenant isolation scoping (`tenantId`), and initial status `PENDING`.
- **FR-006**: The system MUST log all event processing steps with structured JSON logs including event ID, entity type, change ID, and tenant code / ID.
- **FR-007**: The system MUST gracefully handle and log malformed payloads without unhandled consumer crashes.

### Key Entities *(include if feature involves data)*

- **OutboxEvent**: Represents an asynchronous event scheduled for publication, including `id`, `aggregateType`, `aggregateId`, `eventType` (`setting.effective-change.execute`), `payload`, `status` (`PENDING`), `retryCount`, and timestamps.
- **EffectiveChange**: Represents a scheduled master data mutation record across supported entities (`location`, `department`, `grade`, `job_title`, `poc`, `employee_transfer`), holding execution state and payload details.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid `EFFECTIVE_CHANGE_SCHEDULED` messages produce exactly one corresponding `EFFECTIVE_CHANGE_EXECUTE` transactional outbox event.
- **SC-002**: 100% of duplicate `EFFECTIVE_CHANGE_SCHEDULED` messages received within the deduplication window are safely ignored without duplicate outbox entries.
- **SC-003**: Event processing and outbox event creation complete within 50ms under normal operating load.
- **SC-004**: Zero unhandled exceptions or consumer crashes on malformed event payloads.

## Assumptions

- The `EFFECTIVE_CHANGE_SCHEDULED` event is published when an effective change is scheduled by master data modules (Department, Location, Grade, Job Title, PoC, Employee Transfer).
- The Transactional Outbox pattern is used to relay `EFFECTIVE_CHANGE_EXECUTE` events to the message broker / execution pipeline.
- Redis / L2 cache is available for message deduplication by `eventId`.
- Multi-tenancy isolation is preserved by passing `tenantId` in both the incoming event and the resulting outbox payload.
