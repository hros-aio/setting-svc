---
description: "Task list for Job Title Management feature implementation"
---

# Tasks: Job Title Management

**Input**: Design documents from `specs/011-job-title-management/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api-and-events.md`, `quickstart.md`)

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api-and-events.md`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Exact file paths included in descriptions

---

## Phase 1: Setup & Data Access Foundation

**Purpose**: Establish database entities, schema migration, constraints, indexes, and data access repository.

- [X] T001 Verify and update `JobTitleEntity`, constraints (`uq_job_titles_company_code`), foreign keys (`departments`, `grades`), and indexes in `src/modules/job-title/entities/job-title.entity.ts`
- [X] T002 [P] Create TypeORM database migration for Job Title schema, foreign keys, unique constraint `uq_job_titles_company_code`, and indexes in `src/migrations/1723920000000-create-job-title-schema.ts`
- [X] T003 Define `IJobTitleRepository` interface in `src/modules/job-title/repositories/job-title.repository.interface.ts`
- [X] T004 Implement `JobTitleRepository` supporting multi-tenant isolation, company-scoped lookups (`findById`, `findByCode`, `findActive`, `find`, `hasActiveOrScheduled`), and transactional queries in `src/modules/job-title/repositories/job-title.repository.ts`
- [X] T005 [P] Unit tests for `JobTitleRepository` in `test/job-title/job-title.repository.spec.ts`

---

## Phase 2: Foundational DTOs, Enums, & Module Wiring

**Purpose**: Create data transfer objects, validation rules, event enums, and module declarations.

- [X] T006 [P] Add `JobTitleEventType` and `AggregateType.JOB_TITLE` in `src/enums/event-type.enum.ts`, `src/enums/aggregate-type.enum.ts`, and re-export in `src/enums/index.ts`
- [X] T007 [P] Implement `CreateJobTitleDto` with future effective date, UUID validations (`departmentId`, `gradeId`), and field validations in `src/modules/job-title/dtos/create-job-title.dto.ts`
- [X] T008 [P] Implement `UpdateJobTitleDto` with optional field validations (`name`, `departmentId`, `gradeId`, `description`, `effectiveAt`) in `src/modules/job-title/dtos/update-job-title.dto.ts`
- [X] T009 [P] Implement `DeactivateJobTitleDto` and `QueryJobTitleDto` (with pagination, status/department/grade filtering) in `src/modules/job-title/dtos/query-job-title.dto.ts`
- [X] T010 Wire `JobTitleModule` importing `DepartmentModule`, `GradeModule`, `CompanyModule`, `EffectiveChangeModule`, registering controllers, services, repositories, barrel exports in `src/modules/job-title/job-title.module.ts`, `src/modules/job-title/index.ts`, and registering in `src/app.module.ts`

---

## Phase 3: User Story 1 - Create and Schedule a Job Title (Priority: P1) 🎯 MVP

**Goal**: Allow Company Administrators to define and schedule a new Job Title tied to an active Department and Grade within the same Company, validate timezone-aware future effective date, write outbox events, and satisfy onboarding Step 5 (`JOB_TITLE`) atomically.

**Independent Test**: Send `POST /job-titles` with a valid payload, active same-company `departmentId`, `gradeId`, and future effective date; verify Job Title persisted with `scheduled` status, setup step 5 marked `COMPLETED`, and outbox event written.

- [X] T011 [US1] Implement `JobTitleService.create` validating future effective date, verifying Department and Grade belong to the exact same Company and are active (ADR-14, INV-006), verifying code uniqueness, marking Setup Step 5 (`JOB_TITLE`) as completed, and staging `setting.effective-change.scheduled` outbox event in `src/modules/job-title/services/job-title.service.ts`
- [X] T012 [US1] Implement `JobTitleController.create` with `@RequirePermission('job-title:create')`, scoping guards, and DTO validation in `src/modules/job-title/controllers/job-title.controller.ts`
- [X] T013 [P] [US1] Unit and integration tests for job title creation, cross-company rejection, code uniqueness, setup step 5 completion, and outbox event emission in `test/job-title/create-job-title.spec.ts`

---

## Phase 4: User Story 2 - Query Active, Scheduled, and Historical Job Titles (Priority: P1)

**Goal**: Expose endpoints for querying active Job Titles with pagination and filtering, and fetching individual Job Title details (including pending changes and historical state) scoped strictly to the caller's Company.

**Independent Test**: Call `GET /job-titles` (returns active Job Titles for current company with optional department/grade filters) and `GET /job-titles/:id` (returns single Job Title including pending changes or historical details).

- [X] T014 [US2] Implement `JobTitleQueryService` (`findActive`, `find`, `getJobTitleWithPendingChanges`, `getJobTitleHistory`) with strict company isolation and pending change composite projection in `src/modules/job-title/services/job-title-query.service.ts`
- [X] T015 [US2] Implement `JobTitleController.findAll` and `JobTitleController.findById` with `@RequirePermission('job-title:read')` and scoping guards in `src/modules/job-title/controllers/job-title.controller.ts`
- [X] T016 [P] [US2] Unit and integration tests for active job title querying, filtering, pending change composite view, and historical record retrieval in `test/job-title/query-job-title.spec.ts`

---

## Phase 5: User Story 3 - Schedule Job Title Updates (Priority: P2)

**Goal**: Allow Administrators to schedule updates to active Job Titles (including name, department, or grade changes), enforcing same-company validation, single pending change rule, and optimistic concurrency without mutating the active master record before the effective date.

**Independent Test**: Call `PATCH /job-titles/:id` with future date and new department/grade; verify `effective_changes` record created with `scheduled` status and active Job Title row remains unmodified. Attempt a second pending change on the same Job Title and verify 409 Conflict rejection.

- [X] T017 [US3] Implement `JobTitleService.scheduleUpdate` validating future effective date, active status check, revalidating same-company active Department/Grade if modified, enforcing single pending change constraint (`INV-007`), persisting `effective_changes` with optimistic concurrency `expected_updated_at`, and writing outbox event in `src/modules/job-title/services/job-title.service.ts`
- [X] T018 [US3] Implement `JobTitleController.updateJobTitle` with `@RequirePermission('job-title:update')` in `src/modules/job-title/controllers/job-title.controller.ts`
- [X] T019 [P] [US3] Unit and integration tests for job title update scheduling, cross-company reassignment rejection, and single-pending-change validation in `test/job-title/update-job-title.spec.ts`

---

## Phase 6: User Story 4 - Schedule Job Title Deactivation (Priority: P2)

**Goal**: Allow Administrators to schedule deactivation of an active Job Title for a future date without hard deletes.

**Independent Test**: Call `POST /job-titles/:id/deactivate`; verify `effective_changes` record created with action `DEACTIVATE` and Job Title remains `active` until effective date.

- [X] T020 [US4] Implement `JobTitleService.scheduleDeactivation` checking active status, single pending change constraint, creating `effective_changes` record with `operation = 'DEACTIVATE'`, and writing outbox event in `src/modules/job-title/services/job-title.service.ts`
- [X] T021 [US4] Implement `JobTitleController.deactivateJobTitle` with `@RequirePermission('job-title:deactivate')` in `src/modules/job-title/controllers/job-title.controller.ts`
- [X] T022 [P] [US4] Unit and integration tests for job title deactivation scheduling in `test/job-title/deactivate-job-title.spec.ts`

---

## Phase 7: User Story 5 - Automatic Effective Execution and Domain Synchronization (Priority: P3)

**Goal**: Consume `setting.effective-change.execute` Kafka events from Go worker, revalidate preconditions within a transaction, apply state transitions (`scheduled` $\to$ `active`, field update, `active` $\to$ `inactive`), and emit master data events.

**Independent Test**: Trigger consumer with CREATE, UPDATE, and DEACTIVATE command payloads; verify state transitions, idempotency via Redis deduplication, drift conflict detection, and domain event publication.

- [X] T023 [US5] Implement `JobTitleApplyHandler` handling CREATE (`scheduled` $\to$ `active`), UPDATE (applying payload with optimistic concurrency check and conflict handling), and DEACTIVATE (`active` $\to$ `inactive`), emitting `setting.job-title.*` master data outbox events in `src/modules/effective-change/handlers/job-title-apply.handler.ts`
- [X] T024 [US5] Register `JobTitleApplyHandler` in `EffectiveChangeService` and wire into `EffectiveChangeModule` in `src/modules/effective-change/services/effective-change.service.ts` and `src/modules/effective-change/effective-change.module.ts`
- [X] T025 [P] [US5] Unit and integration tests for `JobTitleApplyHandler`, Redis deduplication, idempotent replays, and domain event emissions in `test/effective-change/job-title-apply.handler.spec.ts`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, quality assurance, linting, and documentation.

- [X] T026 [P] Execute end-to-end quickstart validation scenarios from `specs/011-job-title-management/quickstart.md`
- [X] T027 Code formatting, linting (`pnpm lint`), type checking (`tsc --noEmit`), and full test suite verification (`pnpm test`)

---

## Dependencies & Execution Order

```
Phase 1 (Entities & Repository: T001-T005)
  │
Phase 2 (DTOs & Wiring: T006-T010)
  │
  ├──► Phase 3 [US1] (Create Job Title: T011-T013) 🎯 MVP
  │      │
  │      ├──► Phase 4 [US2] (Query Job Titles: T014-T016)
  │      │
  │      ├──► Phase 5 [US3] (Update Job Title: T017-T019) ──┐
  │      │                                                    │
  │      ├──► Phase 6 [US4] (Deactivate Job Title: T020-T022)│
  │      │                                                    │
  │      └────────────────────────────────────────────────────┴──► Phase 7 [US5] (Effective Execution: T023-T025)
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┴──► Phase 8 (Polish: T026-T027)
```

---

## Parallel Execution Opportunities

- **Phase 1 & Phase 2**: T002, T005, T006, T007, T008, T009 can be implemented in parallel once entities and interfaces are defined.
- **Phase 3 & Phase 4**: T013 (create tests) and T016 (query tests) can be built in parallel.
- **Phase 5 & Phase 6**: Update scheduling (T017-T019) and Deactivation scheduling (T020-T022) can be implemented in parallel.
- **Phase 7**: Apply handler tests (T025) can run alongside handler wiring (T023-T024).

---

## Implementation Strategy

### MVP Scope (User Story 1 + User Story 2)
1. Complete **Phase 1** (Entities & Repositories) & **Phase 2** (DTOs & Module Wiring).
2. Complete **Phase 3** (Job Title Creation & Scheduling, Setup Step 5) + **Phase 4** (Active Job Title Querying & Filtering).
3. Validate basic onboarding and job title creation independently.

### Incremental Rollout
1. Deliver **Phase 5** (Update scheduling with same-company revalidation & single pending change check) and **Phase 6** (Deactivation scheduling).
2. Deliver **Phase 7** (Asynchronous execution consumer and master data event publishing).
3. Execute **Phase 8** (End-to-end quickstart test suite & linting).
