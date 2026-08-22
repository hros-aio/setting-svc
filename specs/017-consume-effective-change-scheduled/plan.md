# Implementation Plan: Consume EFFECTIVE_CHANGE_SCHEDULED & Dispatch EFFECTIVE_CHANGE_EXECUTE

**Branch**: `017-consume-effective-change-scheduled` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-consume-effective-change-scheduled/spec.md`

## Summary

Implement an event handler in the `effective-change` module to consume `EFFECTIVE_CHANGE_SCHEDULED` (`setting.effective-change.scheduled`) Kafka events. When received, validate the payload, deduplicate using Redis/L2 cache, and create a corresponding `EFFECTIVE_CHANGE_EXECUTE` (`setting.effective-change.execute`) record in the transactional `outbox_events` table with status `PENDING` within an atomic database transaction.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js >= 20.x, NestJS 10.x  
**Primary Dependencies**: `@nestjs/common`, `@nestjs/microservices`, `@nestjs/typeorm`, `typeorm`, `@new-hros/libs-sql`, `@new-hros/libs-core`  
**Storage**: PostgreSQL 18 via TypeORM, Redis (for event deduplication)  
**Testing**: Jest (Unit testing with AAA pattern), Testcontainers / Supertest (E2E testing)  
**Target Platform**: Linux / Docker / Kubernetes  
**Project Type**: Microservice (NestJS REST & Kafka microservice)  
**Performance Goals**: Event processing and outbox row insertion under 50ms  
**Constraints**: Zero data loss, strict multi-tenant scoping (`tenant_id`), transactional atomicity  
**Scale/Scope**: Handles all effective-dated entity scheduled change events across the organization  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Clean Architecture Layering)**: Consumer delegates business logic to `EffectiveChangeService`; queries and persistence run via TypeORM repositories inside transaction boundaries.
- [x] **Principle II (Polyrepo & Cross-Service Contracts)**: Uses asynchronous Kafka events via Transactional Outbox pattern (`outbox_events`). No direct DB sharing.
- [x] **Principle III (TypeScript Rigor)**: `strict: true`, explicit typing, zero `any`.
- [x] **Principle IV (Testing Discipline)**: Comprehensive unit tests with AAA pattern and mocked/real persistence verification.
- [x] **Principle V (Database Integrity & Transactions)**: Multi-statement operations wrapped in explicit database transactions; uses `OutboxEventEntity`.
- [x] **Principle VI (Security & Multi-tenancy)**: Tenant ID and Company ID scoped in event payloads and outbox records.

## Project Structure

### Documentation (this feature)

```text
specs/017-consume-effective-change-scheduled/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── scheduled-event.contract.json
│   └── execute-outbox-event.contract.json
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/modules/effective-change/
├── consumers/
│   ├── effective-change.consumer.ts         # Add @EventPattern for EFFECTIVE_CHANGE_SCHEDULED
│   └── effective-change.consumer.spec.ts    # Consumer unit tests
├── services/
│   ├── effective-change.service.ts          # Method to create EFFECTIVE_CHANGE_EXECUTE outbox record
│   └── effective-change.service.spec.ts     # Service unit tests
└── effective-change.module.ts               # Module configuration with OutboxEventEntity & services
```

**Structure Decision**: Module-contained NestJS architecture following established setting-svc patterns.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | Follows standard clean architecture and existing outbox conventions |
