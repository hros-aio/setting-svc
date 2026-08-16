---
description: "Task list for Location Management feature implementation"
---

# Tasks: Location Management

**Input**: Design documents from `specs/008-location-management/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api-and-events.md`, `quickstart.md`)

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api-and-events.md`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Exact file paths included in descriptions

---

## Phase 1: Setup & Data Access Foundation

**Purpose**: Establish database entities, schema migration, constraints, and data access repository.

- [X] T001 Define and update `LocationEntity` and database constraints in `src/modules/location/entities/location.entity.ts`
- [X] T002 [P] Create TypeORM database migration for Location schema, partial unique headquarter index, and indexes in `src/migrations/1723800000000-create-location-schema.ts`
- [X] T003 Define `ILocationRepository` interface in `src/modules/location/repositories/location.repository.interface.ts`
- [X] T004 Implement `LocationRepository` supporting multi-tenant isolation, active filtering, setup check, and transactional operations in `src/modules/location/repositories/location.repository.ts`
- [X] T005 [P] Unit tests for `LocationRepository` in `src/modules/location/tests/location.repository.spec.ts`

---

## Phase 2: Foundational DTOs, Enums, & Module Wiring

**Purpose**: Create data transfer objects, validation rules, and module declarations.

- [X] T006 [P] Implement `CreateLocationDto` with future effective date validator in `src/modules/location/dtos/create-location.dto.ts`
- [X] T007 [P] Implement `UpdateLocationDto` with field validations in `src/modules/location/dtos/update-location.dto.ts`
- [X] T008 [P] Implement `DeactivateLocationDto` and `QueryLocationDto` in `src/modules/location/dtos/query-location.dto.ts`
- [X] T009 Wire `LocationModule` with dependencies, exported providers, and repository binding in `src/modules/location/location.module.ts` and barrel in `src/modules/location/index.ts`

---

## Phase 3: User Story 1 - Create and Schedule a Work Location (Priority: P1) 🎯 MVP

**Goal**: Allow Company Administrators to create a new location scheduled for a future effective date, writing outbox events and satisfying company onboarding setup step atomically.

**Independent Test**: Send POST `/api/v1/locations` with future effective date, verify location persisted with `scheduled` status, outbox event written, and setup step `LOCATION` marked `COMPLETED`.

- [X] T010 [US1] Implement `LocationService.createLocation` with timezone-aware future cutoff validation, headquarter pre-check, setup step update, and outbox event write in `src/modules/location/services/location.service.ts`
- [X] T011 [US1] Implement `LocationController.createLocation` with `@Permissions('location:create')` and scoping guards in `src/modules/location/controllers/location.controller.ts`
- [X] T012 [P] [US1] Unit and integration tests for Location creation and setup step progress in `src/modules/location/tests/create-location.spec.ts`

---

## Phase 4: User Story 2 - Query Active and Historical Locations (Priority: P1)

**Goal**: Expose endpoints for listing active locations with pagination and fetching individual location details scoped strictly to caller's Company.

**Independent Test**: Call GET `/api/v1/locations` (returns only active records for current company) and GET `/api/v1/locations/:id` (returns single location including inactive/scheduled states for audit).

- [X] T013 [US2] Implement `LocationService.findActiveLocations` and `LocationService.findById` with multi-company isolation in `src/modules/location/services/location.service.ts`
- [X] T014 [US2] Implement `LocationController.findActiveLocations` and `LocationController.findById` in `src/modules/location/controllers/location.controller.ts`
- [X] T015 [P] [US2] Unit and integration tests for active querying and company isolation in `src/modules/location/tests/query-location.spec.ts`

---

## Phase 5: User Story 3 - Schedule Location Updates via Pending Changes (Priority: P2)

**Goal**: Allow Administrators to schedule updates to active locations, enforcing single pending change rule and optimistic locking without mutating the active operational record.

**Independent Test**: Call PATCH `/api/v1/locations/:id` with future date; verify `effective_changes` record created with `scheduled` status and active location row remains unmodified. Attempt second update and verify 409 Conflict.

- [X] T016 [US3] Implement `LocationService.scheduleUpdate` validating active status, checking single pending change constraint (`INV-007`), snapshotting `expected_updated_at`, and writing outbox event in `src/modules/location/services/location.service.ts`
- [X] T017 [US3] Implement `LocationController.updateLocation` with `@Permissions('location:update')` in `src/modules/location/controllers/location.controller.ts`
- [X] T018 [P] [US3] Unit and integration tests for location update scheduling and concurrency checks in `src/modules/location/tests/update-location.spec.ts`

---

## Phase 6: User Story 4 - Schedule Location Deactivation (Priority: P2)

**Goal**: Allow Administrators to schedule deactivation of an active location for a future date without hard deletes.

**Independent Test**: Call POST `/api/v1/locations/:id/deactivate`; verify `effective_changes` record created with operation `DEACTIVATE` and location remains `active` until effective date.

- [X] T019 [US4] Implement `LocationService.scheduleDeactivation` validating active status, single pending change constraint, and writing outbox event in `src/modules/location/services/location.service.ts`
- [X] T020 [US4] Implement `LocationController.deactivateLocation` with `@Permissions('location:deactivate')` in `src/modules/location/controllers/location.controller.ts`
- [X] T021 [P] [US4] Unit and integration tests for location deactivation scheduling in `src/modules/location/tests/deactivate-location.spec.ts`

---

## Phase 7: User Story 5 - Automatic Effective Execution and State Transition (Priority: P3)

**Goal**: Consume `setting.effective-change.execute` Kafka events from Go worker, revalidate preconditions, apply state transitions (`scheduled` $\to$ `active`, field update, `active` $\to$ `inactive`), and emit master data events.

**Independent Test**: Trigger consumer with CREATE, UPDATE, and DEACTIVATE command payloads; verify state transitions, idempotency via Redis deduplication, drift conflict detection, and domain event publication.

- [X] T022 [US5] Implement `LocationApplyHandler` for CREATE, UPDATE, and DEACTIVATE operations with optimistic lock check and conflict handling in `src/modules/effective-change/handlers/location-apply.handler.ts`
- [X] T023 [US5] Register location apply handler into `EffectiveChangeService` and subscribe in `EffectiveChangeConsumer` with Redis deduplication in `src/modules/effective-change/consumers/effective-change.consumer.ts`
- [X] T024 [P] [US5] Unit and integration tests for effective execution handler, deduplication, and outbox event emissions in `src/modules/effective-change/tests/location-apply.handler.spec.ts`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, quality assurance, linting, and documentation.

- [X] T025 [P] Run quickstart validation scenarios from `specs/008-location-management/quickstart.md`
- [X] T026 Code formatting, linting (`pnpm lint`), and complete test suite validation (`pnpm test`)

---

## Dependencies & Execution Order

```
Phase 1 (Entities & Repository: T001-T005)
  │
Phase 2 (DTOs & Wiring: T006-T009)
  │
  ├──► Phase 3 [US1] (Create Location: T010-T012) 🎯 MVP
  │      │
  ├──► Phase 4 [US2] (Query Locations: T013-T015)
  │      │
  ├──► Phase 5 [US3] (Update Location: T016-T018) ──┐
  │      │                                           │
  ├──► Phase 6 [US4] (Deactivate Location: T019-T021)│
  │      │                                           │
  │      └───────────────────────────────────────────┴──► Phase 7 [US5] (Effective Execution: T022-T024)
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┴──► Phase 8 (Polish: T025-T026)
```

---

## Implementation Strategy

### MVP Scope (User Story 1 + User Story 2)
1. Complete **Phase 1** (Entities & Repositories) & **Phase 2** (DTOs & Wiring).
2. Complete **Phase 3** (Location Creation & Scheduling) + **Phase 4** (Active Location Listing).
3. Validate basic onboarding and location creation independently.

### Incremental Rollout
1. Deliver **Phase 5** (Update scheduling) and **Phase 6** (Deactivation scheduling).
2. Deliver **Phase 7** (Asynchronous execution consumer and domain event publishing).
3. Execute **Phase 8** (End-to-end quickstart test suite & linting).
