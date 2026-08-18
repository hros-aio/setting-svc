# Tasks: Multi-Company Isolation

**Input**: Design documents from `/specs/015-multi-company-isolation/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/multi-company-isolation.contract.md](./contracts/multi-company-isolation.contract.md), [quickstart.md](./quickstart.md)

**Tests**: Unit, integration, and guard test tasks are included to satisfy Principle IV (Testing Discipline & Coverage).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`, `US4`)
- Exact file paths included in all task descriptions

---

## Phase 1: Setup (Shared Infrastructure & Exceptions)

**Purpose**: Establish domain exceptions and test helpers for multi-company isolation.

- [X] T001 Create `CrossCompanyReferenceException` in `src/common/exceptions/cross-company-reference.exception.ts`
- [X] T002 [P] Create `src/common/exceptions/index.ts` re-exporting custom isolation exceptions
- [X] T003 [P] Setup multi-company test fixtures and mock AuthContext utilities in `test/fixtures/multi-company.fixture.ts`

---

## Phase 2: Foundational (Schema, Repository Scoping & Scope Guards)

**Purpose**: Core infrastructure and security guards that MUST be complete before user story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Verify composite unique constraints `(company_id, code)` and indexes in `schema.sql` across `locations`, `departments`, `grades`, `job_titles`, `pocs`, and `effective_changes`
- [X] T005 [P] Implement `TenantScopeGuard` in `src/common/guards/tenant-scope.guard.ts`
- [X] T006 [P] Implement `CompanyScopeGuard` in `src/common/guards/company-scope.guard.ts`
- [X] T007 [P] Create `src/common/guards/index.ts` re-exporting scope guards
- [X] T008 [P] Unit test `CompanyScopeGuard` and `TenantScopeGuard` in `src/common/guards/company-scope.guard.spec.ts`

**Checkpoint**: Foundation ready - domain isolation and guard enforcement can now proceed.

---

## Phase 3: User Story 1 - Independent Company Master Data Ownership & Code Reuse (Priority: P1) 🎯 MVP

**Goal**: Ensure sibling companies within the same tenant independently own master data (Locations, Departments, Grades, Job Titles, PoCs) with composite uniqueness `(company_id, code)`, permitting valid code reuse without collisions while rejecting duplicate codes within the same company.

**Independent Test**: Create Grade `L3`, Department `ENG`, and Location `HQ` in Company A, create the same codes in sibling Company B; verify both persist independently, and verify duplicate code creation within Company A is rejected.

### Tests for User Story 1
- [X] T009 [P] [US1] Unit test company-scoped uniqueness in `LocationService` in `src/modules/location/services/location.service.spec.ts`
- [X] T010 [P] [US1] Unit test company-scoped uniqueness in `GradeService` in `src/modules/grade/services/grade.service.spec.ts`
- [X] T011 [P] [US1] Unit test company-scoped uniqueness in `DepartmentService` in `src/modules/department/services/department.service.spec.ts`
- [X] T012 [P] [US1] Unit test company-scoped uniqueness in `JobTitleService` in `src/modules/job-title/services/job-title.service.spec.ts`

### Implementation for User Story 1
- [X] T013 [P] [US1] Enforce company-scoped uniqueness and scoped query filters in `LocationService` (`src/modules/location/services/location.service.ts`) and `LocationRepository` (`src/modules/location/repositories/location.repository.ts`)
- [X] T014 [P] [US1] Enforce company-scoped uniqueness and scoped query filters in `GradeService` (`src/modules/grade/services/grade.service.ts`) and `GradeRepository` (`src/modules/grade/repositories/grade.repository.ts`)
- [X] T015 [P] [US1] Enforce company-scoped uniqueness and scoped query filters in `DepartmentService` (`src/modules/department/services/department.service.ts`) and `DepartmentRepository` (`src/modules/department/repositories/department.repository.ts`)
- [X] T016 [US1] Enforce company-scoped uniqueness and scoped query filters in `JobTitleService` (`src/modules/job-title/services/job-title.service.ts`) and `JobTitleRepository` (`src/modules/job-title/repositories/job-title.repository.ts`)
- [X] T017 [US1] Enforce company-scoped uniqueness and scoped query filters in `PocService` (`src/modules/poc/services/poc.service.ts`) and `PocRepository` (`src/modules/poc/repositories/poc.repository.ts`)

**Checkpoint**: User Story 1 is fully functional and independently testable. Sibling companies can independently reuse codes without database collisions.

---

## Phase 4: User Story 2 - Prevention of Cross-Company Relational Bindings (Priority: P1)

**Goal**: Enforce domain invariant validations preventing cross-company relational coupling (Job Titles referencing sibling Departments/Grades, cross-company Department parent hierarchies, and tenant-scoped PoC assignments).

**Independent Test**: Submit a command to create a Job Title in Company A referencing a Grade from sibling Company B; verify rejection with `CrossCompanyReferenceException` (HTTP 400).

### Tests for User Story 2
- [X] T018 [P] [US2] Unit test cross-company relational rejection in `JobTitleService` in `src/modules/job-title/services/job-title.service.spec.ts`
- [X] T019 [P] [US2] Unit test cross-company parent department rejection in `DepartmentService` in `src/modules/department/services/department.service.spec.ts`
- [X] T020 [P] [US2] Unit test tenant-scoped employee validation in `PocService` in `src/modules/poc/services/poc.service.spec.ts`

### Implementation for User Story 2
- [X] T021 [US2] Implement cross-company `departmentId` and `gradeId` validation in `JobTitleService` (`src/modules/job-title/services/job-title.service.ts`)
- [X] T022 [US2] Implement cross-company `parentDepartmentId` validation in `DepartmentService` (`src/modules/department/services/department.service.ts`)
- [X] T023 [US2] Implement tenant-scoped employee validation in `PocService` (`src/modules/poc/services/poc.service.ts`)

**Checkpoint**: User Stories 1 AND 2 work together. Master data is both isolated in naming and protected from cross-company foreign entity linkages.

---

## Phase 5: User Story 3 - Context-Driven Access Control & Request Scoping (Priority: P2)

**Goal**: Intercept incoming HTTP requests at controller boundaries with `TenantScopeGuard` and `CompanyScopeGuard`, rejecting mismatched or unauthorized company access attempts before reaching application services.

**Independent Test**: Send requests with user credentials authorized only for Company A targeting Company B's endpoints; verify that requests are blocked with HTTP 403 Forbidden.

### Tests for User Story 3
- [X] T024 [P] [US3] Controller integration tests for company scope verification in `src/modules/company/controllers/company.controller.spec.ts`
- [X] T025 [P] [US3] Controller integration tests for company scope verification in `src/modules/location/controllers/location.controller.spec.ts`
- [X] T026 [P] [US3] Controller integration tests for company scope verification in `src/modules/department/controllers/department.controller.spec.ts`
- [X] T027 [P] [US3] Controller integration tests for company scope verification in `src/modules/job-title/controllers/job-title.controller.spec.ts`
- [X] T028 [P] [US3] Controller integration tests for company scope verification in `src/modules/poc/controllers/poc.controller.spec.ts`

### Implementation for User Story 3
- [X] T029 [US3] Attach `TenantScopeGuard` and `CompanyScopeGuard` across all company controllers in `src/modules/company/controllers/company.controller.ts`, `src/modules/location/controllers/location.controller.ts`, `src/modules/department/controllers/department.controller.ts`, `src/modules/grade/controllers/grade.controller.ts`, `src/modules/job-title/controllers/job-title.controller.ts`, and `src/modules/poc/controllers/poc.controller.ts`

**Checkpoint**: Transport boundary security is enforced across all company-scoped endpoints.

---

## Phase 6: User Story 4 - Isolated Asynchronous Event Processing & Effective Transitions (Priority: P3)

**Goal**: Ensure asynchronous domain events and effective-dated change execution events are serialized and partitioned by `${tenantId}:${companyId}`, guaranteeing strictly isolated async processing per company.

**Independent Test**: Schedule concurrent effective-dated changes across sibling companies and verify that outbox events and Kafka message keys carry `${tenantId}:${companyId}`.

### Tests for User Story 4
- [X] T030 [P] [US4] Unit test outbox partition key serialization in `src/modules/effective-change/services/effective-change.service.spec.ts`

### Implementation for User Story 4
- [X] T031 [US4] Configure outbox event serialization and Kafka producer to format partition keys as `${tenantId}:${companyId}` across `src/modules/effective-change/services/effective-change.service.ts` and `src/modules/company/services/company.service.ts`
- [X] T032 [US4] Verify worker consumer handlers enforce `tenantId` and `companyId` context scoping in `src/modules/effective-change/consumers/effective-change.consumer.ts`

**Checkpoint**: Async event processing and worker execution are partitioned and isolated per company.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end verification and regression testing across the entire service.

- [X] T033 [P] Create end-to-end multi-company isolation integration test suite in `test/multi-company-isolation.spec.ts`
- [X] T034 Execute quickstart verification scenarios and validate full test suite passing with `pnpm test`

---

## Dependencies & Execution Order

### Phase Dependencies
```
Phase 1: Setup (T001 - T003)
   │
   ▼
Phase 2: Foundational (T004 - T008)  ◄── Blocks all User Stories
   │
   ├───────────────────────┬───────────────────────┐
   ▼                       ▼                       ▼
Phase 3: US1 (P1)      Phase 4: US2 (P1)      Phase 5: US3 (P2)
(T009 - T017)          (T018 - T023)          (T024 - T029)
   │                       │                       │
   └───────────────────────┼───────────────────────┘
                           ▼
                   Phase 6: US4 (P3)
                   (T030 - T032)
                           │
                           ▼
                   Phase 7: Polish
                   (T033 - T034)
```

### Parallel Execution Opportunities
- **Phase 1**: `T002`, `T003` can run in parallel with `T001`.
- **Phase 2**: `T005`, `T006`, `T007`, `T008` can run in parallel after `T004`.
- **Phase 3 (US1)**: `T009`, `T010`, `T011`, `T012` unit tests can run in parallel. `T013`, `T014`, `T015` repository implementations can run in parallel.
- **Phase 4 (US2)**: `T018`, `T019`, `T020` unit tests can run in parallel.
- **Phase 5 (US3)**: `T024`, `T025`, `T026`, `T027`, `T028` controller tests can run in parallel.
- **Phase 7**: `T033` can run in parallel.

---

## Implementation Strategy

### MVP First (Phase 1, 2, and 3 - User Story 1)
1. Complete Setup (Phase 1) and Foundational (Phase 2).
2. Implement User Story 1 (Phase 3).
3. **STOP and VALIDATE**: Verify sibling companies can independently create and reuse codes (`L3`, `ENG`, `HQ`) without collisions.

### Incremental Delivery
1. Add User Story 2 (Phase 4): Invariant checks prevent cross-company entity linkages.
2. Add User Story 3 (Phase 5): Attach `CompanyScopeGuard` across all controllers.
3. Add User Story 4 (Phase 6): Partition outbox and Kafka messages by `tenantId:companyId`.
4. Polish (Phase 7): End-to-end integration test execution (`pnpm test`).
