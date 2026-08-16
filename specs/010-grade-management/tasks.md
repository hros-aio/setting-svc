---
description: "Task list for Grade Management feature implementation"
---

# Tasks: Grade Management

**Input**: Design documents from `specs/010-grade-management/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api-and-events.md`, `quickstart.md`)

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api-and-events.md`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Exact file paths included in descriptions

---

## Phase 1: Setup & Data Access Foundation

**Purpose**: Establish database entities, schema migration, constraints, and data access repository.

- [X] T001 Define and verify `GradeEntity`, constraints (`uq_grades_company_code`), and indexes in `src/modules/grade/entities/grade.entity.ts`
- [X] T002 [P] Create TypeORM database migration for Grade schema, composite unique constraint `uq_grades_company_code`, and foreign key indexes in `src/migrations/1723910000000-create-grade-schema.ts`
- [X] T003 Define `IGradeRepository` interface in `src/modules/grade/repositories/grade.repository.interface.ts`
- [X] T004 Implement `GradeRepository` supporting multi-tenant isolation, company-scoped lookups (`findById`, `findByCode`, `findActive`, `find`, `hasActiveOrScheduled`), and transactional queries in `src/modules/grade/repositories/grade.repository.ts`
- [X] T005 [P] Unit tests for `GradeRepository` in `src/modules/grade/tests/grade.repository.spec.ts`

---

## Phase 2: Foundational DTOs, Enums, & Module Wiring

**Purpose**: Create data transfer objects, validation rules, event enums, and module declarations.

- [X] T006 [P] Add `GradeEventType` to `src/enums/event-type.enum.ts` and re-export in `src/enums/index.ts`
- [X] T007 [P] Implement `CreateGradeDto` with future effective date and field validations in `src/modules/grade/dtos/create-grade.dto.ts`
- [X] T008 [P] Implement `UpdateGradeDto` with field validations in `src/modules/grade/dtos/update-grade.dto.ts`
- [X] T009 [P] Implement `DeactivateGradeDto` and `QueryGradeDto` (with pagination, status filtering) in `src/modules/grade/dtos/query-grade.dto.ts`
- [X] T010 Wire `GradeModule` with controller, services, repository, outbox integration, and barrel exports in `src/modules/grade/grade.module.ts`, `src/modules/grade/index.ts`, and register in `src/app.module.ts`

---

## Phase 3: User Story 1 - Create and Schedule a Grade (Priority: P1) 🎯 MVP

**Goal**: Allow Company Administrators to create a new Grade scheduled for a future effective date, validate code uniqueness within the company, write outbox events, and satisfy company onboarding setup step 4 (`GRADE`) atomically.

**Independent Test**: Send `POST /grades` with a valid payload and future effective date; verify Grade persisted with `scheduled` status, outbox event written, and setup step 4 marked `COMPLETED`.

- [X] T011 [US1] Implement `GradeService.create` validating timezone-aware future effective date, checking code uniqueness within company, marking Setup Step 4 (`GRADE`) as completed, and staging `setting.effective-change.scheduled` outbox event in `src/modules/grade/services/grade.service.ts`
- [X] T012 [US1] Implement `GradeController.create` with `@Permissions('grade:create')`, scoping guards, and DTO validation in `src/modules/grade/controllers/grade.controller.ts`
- [X] T013 [P] [US1] Unit and integration tests for grade creation, code uniqueness, setup step completion, and outbox event emission in `test/grade/create-grade.spec.ts`

---

## Phase 4: User Story 2 - Query Active, Scheduled, and Historical Grades (Priority: P1)

**Goal**: Expose endpoints for querying active Grades with pagination and fetching individual Grade details (including pending changes and historical state) scoped strictly to the caller's Company.

**Independent Test**: Call `GET /grades` (returns active Grades for current company) and `GET /grades/:id` (returns single Grade including pending changes or historical details).

- [X] T014 [US2] Implement `GradeQueryService` (`findActive`, `find`, `getGradeWithPendingChanges`, `getGradeHistory`) with strict company isolation in `src/modules/grade/services/grade-query.service.ts`
- [X] T015 [US2] Implement `GradeController.findAll` and `GradeController.findById` with scoping guards in `src/modules/grade/controllers/grade.controller.ts`
- [X] T016 [P] [US2] Unit and integration tests for active grade querying, pending change composite view, and historical record retrieval in `test/grade/query-grade.spec.ts`

---

## Phase 5: User Story 3 - Schedule Grade Updates (Priority: P2)

**Goal**: Allow Administrators to schedule updates to active Grades, enforcing single pending change rule and optimistic concurrency without mutating the active master record before the effective date.

**Independent Test**: Call `PATCH /grades/:id` with future date; verify `effective_changes` record created with `scheduled` status and active Grade row remains unmodified. Attempt a second pending change on the same Grade and verify 409 Conflict rejection.

- [X] T017 [US3] Implement `GradeService.update` enforcing single pending change constraint (`INV-007`), active status check, persisting in `effective_changes` with optimistic concurrency `expected_updated_at`, and writing outbox event in `src/modules/grade/services/grade.service.ts`
- [X] T018 [US3] Implement `GradeController.update` with `@Permissions('grade:update')` in `src/modules/grade/controllers/grade.controller.ts`
- [X] T019 [P] [US3] Unit and integration tests for grade update scheduling and single-pending-change validation in `test/grade/update-grade.spec.ts`

---

## Phase 6: User Story 4 - Schedule Grade Deactivation (Priority: P2)

**Goal**: Allow Administrators to schedule deactivation of an active Grade for a future date without hard deletes.

**Independent Test**: Call `POST /grades/:id/deactivate`; verify `effective_changes` record created with action `DEACTIVATE` and Grade remains `active` until effective date.

- [X] T020 [US4] Implement `GradeService.deactivate` checking active status, single pending change constraint, creating `effective_changes` record with `action = 'DEACTIVATE'`, and writing outbox event in `src/modules/grade/services/grade.service.ts`
- [X] T021 [US4] Implement `GradeController.deactivate` with `@Permissions('grade:deactivate')` in `src/modules/grade/controllers/grade.controller.ts`
- [X] T022 [P] [US4] Unit and integration tests for grade deactivation scheduling in `test/grade/deactivate-grade.spec.ts`

---

## Phase 7: User Story 5 - Automatic Effective Execution and Domain Synchronization (Priority: P3)

**Goal**: Consume `setting.effective-change.execute` Kafka events from Go worker, revalidate preconditions within a transaction, apply state transitions (`scheduled` $\to$ `active`, field update, `active` $\to$ `inactive`), and emit master data events.

**Independent Test**: Trigger consumer with CREATE, UPDATE, and DEACTIVATE command payloads; verify state transitions, idempotency via Redis deduplication, drift conflict detection, and domain event publication.

- [X] T023 [US5] Implement `GradeApplyHandler` handling CREATE (`scheduled` $\to$ `active`), UPDATE (applying payload with optimistic concurrency check and conflict handling), and DEACTIVATE (`active` $\to$ `inactive`), emitting `setting.grade.*` master data outbox events in `src/modules/effective-change/handlers/grade-apply.handler.ts`
- [X] T024 [US5] Register `GradeApplyHandler` in `EffectiveChangeService` and wire into `EffectiveChangeModule` in `src/modules/effective-change/services/effective-change.service.ts` and `src/modules/effective-change/effective-change.module.ts`
- [X] T025 [P] [US5] Unit and integration tests for `GradeApplyHandler`, Redis deduplication, idempotent replays, and domain event emissions in `test/effective-change/grade-apply.handler.spec.ts`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, quality assurance, linting, and documentation.

- [X] T026 [P] Execute end-to-end quickstart validation scenarios from `specs/010-grade-management/quickstart.md`
- [X] T027 Code formatting, linting (`pnpm lint`), type checking (`tsc --noEmit`), and full test suite verification (`pnpm test`)

---

## Dependencies & Execution Order

```
Phase 1 (Entities & Repository: T001-T005)
  │
Phase 2 (DTOs & Wiring: T006-T010)
  │
  ├──► Phase 3 [US1] (Create Grade: T011-T013) 🎯 MVP
  │      │
  ├──► Phase 4 [US2] (Query Grades: T014-T016)
  │      │
  ├──► Phase 5 [US3] (Update Grade: T017-T019) ──┐
  │      │                                         │
  ├──► Phase 6 [US4] (Deactivate Grade: T020-T022)│
  │      │                                         │
  │      └─────────────────────────────────────────┴──► Phase 7 [US5] (Effective Execution: T023-T025)
  │                                                               │
  └───────────────────────────────────────────────────────────────┴──► Phase 8 (Polish: T026-T027)
```

---

## Implementation Strategy

### MVP Scope (User Story 1 + User Story 2)
1. Complete **Phase 1** (Entities & Repositories) & **Phase 2** (DTOs & Wiring).
2. Complete **Phase 3** (Grade Creation & Scheduling, Setup Step 4) + **Phase 4** (Active Grade Querying).
3. Validate basic onboarding and grade creation independently.

### Incremental Rollout
1. Deliver **Phase 5** (Update scheduling with single pending change check) and **Phase 6** (Deactivation scheduling).
2. Deliver **Phase 7** (Asynchronous execution consumer and domain event publishing).
3. Execute **Phase 8** (End-to-end quickstart test suite & linting).
