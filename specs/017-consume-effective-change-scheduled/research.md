# Research: Consume EFFECTIVE_CHANGE_SCHEDULED & Dispatch EFFECTIVE_CHANGE_EXECUTE

## Overview & Context

In the Setting Service, effective-dated master data changes (for Location, Department, Grade, Job Title, Point of Contact, and Employee Transfer) are initiated by producing an `EFFECTIVE_CHANGE_SCHEDULED` event. The external scheduler (or internal scheduler) triggers these changes, and when the effective change scheduling event (`setting.effective-change.scheduled`) is consumed, the service creates a transactional outbox event of type `EFFECTIVE_CHANGE_EXECUTE` (`setting.effective-change.execute`).

This document captures the architectural decisions, event contracts, deduplication strategies, and outbox persistence mechanisms for consuming `EFFECTIVE_CHANGE_SCHEDULED`.

## Research Questions & Decisions

### Decision 1: Consumer Topology & Event Pattern
- **Decision**: Extend `EffectiveChangeConsumer` (or add an event pattern handler) with `@EventPattern(EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED)`.
- **Rationale**: Keeps event consumer logic cohesive within `src/modules/effective-change/consumers/effective-change.consumer.ts`. The controller is already registered in `EffectiveChangeModule`.
- **Alternatives Considered**: Creating a dedicated `EffectiveChangeScheduledConsumer`. Rejected because `EffectiveChangeConsumer` currently manages `EFFECTIVE_CHANGE_EXECUTE` and handling both related events in this controller maintains high domain cohesion.

### Decision 2: Scheduled Event Processing Workflow
- **Decision**: 
  1. Receive event payload with `eventId`, `eventType`, `timestamp`, and `payload` (`changeId`, `entityType`, `operation`, `effectiveAt`, `targetCompanyId`, `tenantId`, etc.).
  2. Validate message schema & required fields.
  3. Perform Redis/L2 cache-based deduplication with key `setting:dedup:${eventId}` (24-hour TTL).
  4. Invoke `EffectiveChangeService.scheduleExecution(...)` (or a dedicated method) inside a transactional context to write an `OutboxEventEntity` with:
     - `aggregateType`: mapped from `entityType` or entity identifier
     - `aggregateId`: `changeId`
     - `eventType`: `EffectiveChangeEventType.EFFECTIVE_CHANGE_EXECUTE` (`setting.effective-change.execute`)
     - `payload`: execution command payload
     - `status`: `OutboxStatus.PENDING`
- **Rationale**: Adheres to the Transactional Outbox pattern required by Constitution Principle II and Principle V.
- **Alternatives Considered**: Directly executing the change upon receiving scheduled event. Rejected because the worker scheduling architecture decouples scheduling from execution, and publishing `EFFECTIVE_CHANGE_EXECUTE` outbox event is the explicit requirement.

### Decision 3: Error Handling, Malformed Payload & Deduplication
- **Decision**: 
  - Malformed payloads (missing `changeId`, `entityType`, `tenantId`) are logged with `logger.warn` and skipped without throwing unhandled exceptions to prevent Kafka partition blocking.
  - Duplicate messages recognized in Redis cache or existing outbox entries are acknowledged and safely skipped.
- **Rationale**: Prevents infinite poison pill crash-loops in Kafka consumers while logging structured context for observability.

### Decision 4: Testing Strategy
- **Decision**:
  - Unit tests for consumer handling `EFFECTIVE_CHANGE_SCHEDULED`, verifying deduplication, payload validation, and service invocation.
  - Unit tests for service handling outbox record creation.
  - End-to-end / integration tests with Testcontainers verifying Kafka event consumption and transactional outbox row creation in PostgreSQL.
