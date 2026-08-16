---
description: "Task list for Department Management feature implementation"
---

# Tasks: Department Management

**Input**: Design documents from `specs/009-department-management/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api-and-events.md`, `quickstart.md`)

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api-and-events.md`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Exact file paths included in descriptions

---

## Phase 1: Setup & Data Access Foundation

**Purpose**: Establish database entities, schema migration, constraints, and data access repository.

- [X] T001 Define and verify `DepartmentEntity`, constraints (`ck_departments_not_self_parent`, `uq_departments_company_code`), and indexes in `src/modules/department/entities/department.entity.ts`
- [X] T002 [P] Create TypeORM database migration for Department schema, self-parent check constraint, composite unique index, and foreign key indexes in `src/migrations/1723900000000-create-department-schema.ts`
- [X] T003 Define `IDepartmentRepository` interface in `src/modules/department/repositories/department.repository.interface.ts`
- [X] T004 Implement `DepartmentRepository` supporting multi-tenant isolation, ancestor chain traversal for anti-cycle validation (depth 50), active/all department listing, and transactional save in `src/modules/department/repositories/department.repository.ts`
- [X] T005 [P] Unit tests for `DepartmentRepository` and ancestor traversal logic in `src/modules/department/tests/department.repository.spec.ts`

---

## Phase 2: Foundational DTOs, Enums, & Module Wiring

**Purpose**: Create data transfer objects, validation rules, event enums, and module declarations.

- [X] T006 [P] Add `DepartmentEventType` to `src/enums/event-type.enum.ts` and re-export in `src/enums/index.ts`
- [X] T007 [P] Implement `CreateDepartmentDto` with future effective date and validation rules in `src/modules/department/dtos/create-department.dto.ts`
- [X] T008 [P] Implement `UpdateDepartmentDto` with field validations in `src/modules/department/dtos/update-department.dto.ts`
- [X] T009 [P] Implement `DeactivateDepartmentDto` and `QueryDepartmentDto` (with pagination, flat/tree mode) in `src/modules/department/dtos/query-department.dto.ts`
- [X] T010 Wire `DepartmentModule` with controller, service, repository, outbox integration, and barrel exports in `src/modules/department/department.module.ts`, `src/modules/department/index.ts`, and register in `src/app.module.ts`

---

## Phase 3: User Story 1 - Create and Schedule a Department (Priority: P1) 🎯 MVP

**Goal**: Allow Company Administrators to create a new department scheduled for a future effective date, validate parent department constraints, write outbox events, and satisfy company onboarding setup step 3 (`DEPARTMENT`) atomically.

**Independent Test**: Send `POST /departments` with a valid payload, same-company parent, and future effective date; verify department persisted with `scheduled` status, outbox event written, and setup step 3 marked `COMPLETED`.

- [X] T011 [US1] Implement `DepartmentService.create` validating timezone-aware future effective date, parent department validity (same company, active status, not self), marking Setup Step 3 (`DEPARTMENT`) completed, and staging `setting.effective-change.scheduled` outbox event in `src/modules/department/services/department.service.ts`
- [X] T012 [US1] Implement `DepartmentController.create` with `@Permissions('department:create')`, scoping guards, and DTO validation in `src/modules/department/controllers/department.controller.ts`
- [X] T013 [P] [US1] Unit and integration tests for department creation, parent validation, setup step completion, and outbox event emission in `test/department/create-department.spec.ts`

---

## Phase 4: User Story 2 - Query Active and Historical Departments with Multi-Company Isolation (Priority: P1)

**Goal**: Expose endpoints for listing active departments (flat or hierarchical tree) with pagination and fetching individual department details scoped strictly to caller's Company.

**Independent Test**: Call `GET /departments` (returns only active departments for current company in flat/tree view) and `GET /departments/:id` (returns single department including inactive/scheduled states for audit).

- [X] T014 [US2] Implement `DepartmentService.findAll` (flat and hierarchical tree construction) and `DepartmentService.findById` with strict company isolation in `src/modules/department/services/department.service.ts`
- [X] T015 [US2] Implement `DepartmentController.findAll` and `DepartmentController.findById` with scoping guards in `src/modules/department/controllers/department.controller.ts`
- [X] T016 [P] [US2] Unit and integration tests for active department querying, tree formatting, historical record retrieval, and company isolation in `test/department/query-department.spec.ts`

---

## Phase 5: User Story 3 - Update Department with Hierarchy Loop Protection (Priority: P2)

**Goal**: Allow Administrators to schedule updates to active departments, enforcing single pending change rule, optimistic concurrency, and anti-cycle ancestor traversal without mutating the active master record before effective date.

**Independent Test**: Call `PATCH /departments/:id` with future date; verify `effective_changes` record created with `scheduled` status and active department row remains unmodified. Attempt circular parent assignment (A $\to$ B $\to$ A) and verify 409 Conflict rejection.

- [X] T017 [US3] Implement `DepartmentService.update` enforcing single pending change constraint (`INV-007`), walking ancestor chain via `findAncestorChain` to reject circular loops (A $\to$ B $\to$ A), persisting in `effective_changes` with optimistic concurrency `expected_updated_at`, and writing outbox event in `src/modules/department/services/department.service.ts`
- [X] T018 [US3] Implement `DepartmentController.update` with `@Permissions('department:update')` in `src/modules/department/controllers/department.controller.ts`
- [X] T019 [P] [US3] Unit and integration tests for department update scheduling, ancestor chain anti-cycle detection, and single-pending-change validation in `test/department/update-department.spec.ts`

---

## Phase 6: User Story 4 - Schedule Department Deactivation (Priority: P2)

**Goal**: Allow Administrators to schedule deactivation of an active department for a future date without hard deletes.

**Independent Test**: Call `POST /departments/:id/deactivate`; verify `effective_changes` record created with operation `DEACTIVATE` and department remains `active` until effective date.

- [X] T020 [US4] Implement `DepartmentService.deactivate` checking active status, single pending change constraint, creating `effective_changes` record with `change_type = 'DEACTIVATE'`, and writing outbox event in `src/modules/department/services/department.service.ts`
- [X] T021 [US4] Implement `DepartmentController.deactivate` with `@Permissions('department:deactivate')` in `src/modules/department/controllers/department.controller.ts`
- [X] T022 [P] [US4] Unit and integration tests for department deactivation scheduling in `test/department/deactivate-department.spec.ts`

---

## Phase 7: User Story 5 - Automatic Effective Execution and State Transition (Priority: P3)

**Goal**: Consume `setting.effective-change.execute` Kafka events from Go worker, revalidate preconditions, apply state transitions (`scheduled` $\to$ `active`, field update, `active` $\to$ `inactive`), and emit master data events.

**Independent Test**: Trigger consumer with CREATE, UPDATE, and DEACTIVATE command payloads; verify state transitions, idempotency via Redis deduplication, drift conflict detection, and domain event publication.

- [X] T023 [US5] Implement `DepartmentApplyHandler` handling CREATE (`scheduled` $\to$ `active`), UPDATE (applying payload with optimistic concurrency check and conflict handling), and DEACTIVATE (`active` $\to$ `inactive`), emitting `setting.department.*` master data outbox events in `src/modules/effective-change/handlers/department-apply.handler.ts`
- [X] T024 [US5] Register `DepartmentApplyHandler` in `EffectiveChangeService` and wire into `EffectiveChangeModule` in `src/modules/effective-change/services/effective-change.service.ts` and `src/modules/effective-change/effective-change.module.ts`
- [X] T025 [P] [US5] Unit and integration tests for `DepartmentApplyHandler`, Redis deduplication, idempotent replays, and domain event emissions in `test/effective-change/department-apply.handler.spec.ts`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, quality assurance, linting, and documentation.

- [X] T026 [P] Execute end-to-end quickstart validation scenarios from `specs/009-department-management/quickstart.md`
- [X] T027 Code formatting, linting (`pnpm lint`), type checking (`tsc --noEmit`), and full test suite verification (`pnpm test`)

---

## Dependencies & Execution Order

```
Phase 1 (Entities & Repository: T001-T005)
  │
Phase 2 (DTOs & Wiring: T006-T010)
  │
  ├──► Phase 3 [US1] (Create Department: T011-T013) 🎯 MVP
  │      │
  ├──► Phase 4 [US2] (Query Departments: T014-T016)
  │      │
  ├──► Phase 5 [US3] (Update Department: T017-T019) ──┐
  │      │                                             │
  ├──► Phase 6 [US4] (Deactivate Department: T020-T022)│
  │      │                                             │
  │      └─────────────────────────────────────────────┴──► Phase 7 [US5] (Effective Execution: T023-T025)
  │                                                                   │
  └───────────────────────────────────────────────────────────────────┴──► Phase 8 (Polish: T026-T027)
```

---

## Implementation Strategy

### MVP Scope (User Story 1 + User Story 2)
1. Complete **Phase 1** (Entities & Repositories) & **Phase 2** (DTOs & Wiring).
2. Complete **Phase 3** (Department Creation & Scheduling, Setup Step 3) + **Phase 4** (Active Department Querying).
3. Validate basic onboarding and department creation independently.

### Incremental Rollout
1. Deliver **Phase 5** (Update scheduling with anti-cycle checks) and **Phase 6** (Deactivation scheduling).
2. Deliver **Phase 7** (Asynchronous execution consumer and domain event publishing).
3. Execute **Phase 8** (End-to-end quickstart test suite & linting).
