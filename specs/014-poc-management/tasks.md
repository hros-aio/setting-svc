# Tasks: Organization Responsibility (Point of Contact) Management

**Input**: Design documents from `/specs/014-poc-management/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/poc-management.contract.md, quickstart.md

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3], [US4], [US5])

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define event types, enums, and module definitions for PoC domain

- [x] T001 [P] Add `PocEventType` (`setting.poc.assigned`, `setting.poc.replaced`, `setting.poc.deactivated`) and update `EventType` enum in `src/enums/event-type.enum.ts` and `src/enums/index.ts`
- [x] T002 [P] Define `PocType` allow-list enum (`COUNTRY_HEAD`, `HR_HEAD`, `FINANCE_HEAD`, `IT_HEAD`, `PAYROLL_OWNER`) in `src/enums/poc-type.enum.ts` and re-export in `src/enums/index.ts`
- [x] T003 Initialize `PocModule` structure and export index in `src/modules/poc/index.ts` and `src/modules/poc/poc.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence mappings and data-access layer required before implementing user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Define `PocEntity` with partial unique index `uq_pocs_one_active_per_type` on `(company_id, poc_type) WHERE status <> 'inactive'` in `src/modules/poc/entities/poc.entity.ts`
- [x] T005 [P] Create `EmployeeReferenceRepository` interface and implementation for local read-only projection queries in `src/modules/employee-reference/repositories/employee-reference.repository.ts` and update `src/modules/employee-reference/employee-reference.module.ts`
- [x] T006 Create `PocRepositoryInterface` and `PocRepository` implementation with company-scoped lookups, conflict checks, and history queries in `src/modules/poc/repositories/poc.repository.interface.ts` and `src/modules/poc/repositories/poc.repository.ts`
- [x] T007 Unit test `PocRepository` methods and constraint handling in `src/modules/poc/repositories/poc.repository.spec.ts`

**Checkpoint**: Core persistence layer ready. User story implementation can now proceed.

---

## Phase 3: User Story 1 - Initial Organization Responsibility Assignment (Priority: P1) 🎯 MVP

**Goal**: Enable Administrators to assign an active employee to a PoC responsibility type with future effective date, scheduling the assignment, publishing outbox events, and automatically completing Company Setup Step 8 (`POC`).

**Independent Test**: Submit `POST /companies/:companyId/pocs` with a valid employee and future date; verify `pocs` record created in `scheduled` status, outbox event written, and Company Setup Step 8 marked `COMPLETED`.

### Tests for User Story 1
- [x] T008 [P] [US1] Unit test `PocService.create` initial assignment logic and Step 8 completion in `src/modules/poc/services/poc.service.spec.ts`
- [x] T009 [P] [US1] Unit test `PocController.create` endpoint and validation guards in `src/modules/poc/controllers/poc.controller.spec.ts`

### Implementation for User Story 1
- [x] T010 [P] [US1] Create `CreatePocDto` with `class-validator` decorators for `pocType`, `employeeId`, and `effectiveAt` in `src/modules/poc/dtos/create-poc.dto.ts`
- [x] T011 [US1] Implement `PocService.create` method with employee validation, future date check ($\ge$ next business day), transactional `pocs` insertion, outbox event emission, and `CompanySetupCommandService.markStepComplete` call in `src/modules/poc/services/poc.service.ts`
- [x] T012 [US1] Implement `PocController.create` endpoint `POST /companies/:companyId/pocs` protected by `AuthGuard`, `PermissionGuard`, and `@RequirePermission('poc:create')` in `src/modules/poc/controllers/poc.controller.ts`
- [x] T013 [US1] Implement `PocApplyHandler` create execution handler for `setting.effective-change.execute` callbacks to transition `pocs.status` to `active` and publish `setting.poc.assigned` in `src/modules/effective-change/handlers/poc-apply.handler.ts`

**Checkpoint**: User Story 1 functional and independently testable as the core MVP.

---

## Phase 4: User Story 2 - Responsibility Replacement and Historical Tracking (Priority: P2)

**Goal**: Enable Administrators to schedule future-dated replacement of an existing PoC holder while preserving current active assignments, enforcing the single-pending-change constraint, and applying transitions on schedule.

**Independent Test**: Submit `PUT /companies/:companyId/pocs/:pocId/replace` with a new employee ID and future date; verify `effective_changes` row created in `scheduled` status without mutating current active PoC immediately, and verify apply execution transitions previous holder to `inactive` and successor to `active`.

### Tests for User Story 2
- [x] T014 [P] [US2] Unit test replacement command and single-pending-change validation in `src/modules/poc/services/poc.service.spec.ts`
- [x] T015 [P] [US2] Unit test `PocApplyHandler` replacement execution and domain event emission in `src/modules/effective-change/handlers/poc-apply.handler.spec.ts`

### Implementation for User Story 2
- [x] T016 [P] [US2] Create `ReplacePocDto` with `newEmployeeId`, `effectiveAt`, and optional `reason` in `src/modules/poc/dtos/replace-poc.dto.ts`
- [x] T017 [US2] Implement `PocService.replace` method with active assignment verification, pending change check, and `effective_changes` scheduling in `src/modules/poc/services/poc.service.ts`
- [x] T018 [US2] Implement `PocController.replace` endpoint `PUT /companies/:companyId/pocs/:pocId/replace` with `@RequirePermission('poc:update')` in `src/modules/poc/controllers/poc.controller.ts`
- [x] T019 [US2] Implement `PocApplyHandler` update execution branch (archive previous to `inactive`, activate new holder, emit `setting.poc.replaced`) in `src/modules/effective-change/handlers/poc-apply.handler.ts`

**Checkpoint**: User Story 2 complete. Role handoffs and history preservation operational.

---

## Phase 5: User Story 3 - Responsibility Deactivation (Priority: P3)

**Goal**: Enable Administrators to schedule the deactivation of a PoC responsibility when a role is retired, transitioning the record to inactive at the effective date and emitting domain events.

**Independent Test**: Submit `DELETE /companies/:companyId/pocs/:pocId` with a future date; verify pending `DEACTIVATE` record created in `effective_changes`, and verify apply execution transitions status to `inactive`.

### Tests for User Story 3
- [x] T020 [P] [US3] Unit test deactivation command and apply handler in `src/modules/poc/services/poc.service.spec.ts`

### Implementation for User Story 3
- [x] T021 [P] [US3] Create `DeactivatePocDto` with `effectiveAt` and optional `reason` in `src/modules/poc/dtos/deactivate-poc.dto.ts`
- [x] T022 [US3] Implement `PocService.deactivate` method creating pending `DEACTIVATE` record in `src/modules/poc/services/poc.service.ts`
- [x] T023 [US3] Implement `PocController.deactivate` endpoint `DELETE /companies/:companyId/pocs/:pocId` with `@RequirePermission('poc:deactivate')` in `src/modules/poc/controllers/poc.controller.ts`
- [x] T024 [US3] Implement `PocApplyHandler` deactivation execution branch (mark `inactive`, emit `setting.poc.deactivated`) in `src/modules/effective-change/handlers/poc-apply.handler.ts`

**Checkpoint**: User Story 3 complete. Responsibilities can be retired cleanly.

---

## Phase 6: User Story 4 - Multi-Responsibility and Multi-Company Assignments (Priority: P3)

**Goal**: Ensure individuals can hold multiple distinct responsibility types within the same company or across sibling companies concurrently.

**Independent Test**: Assign the same employee to `HR_HEAD` and `FINANCE_HEAD` in Company A, and to `HR_HEAD` in Company B; verify all records coexist and function independently without constraint violations.

### Tests & Validation for User Story 4
- [x] T025 [P] [US4] Add multi-responsibility and sibling-company assignment test suite in `src/modules/poc/tests/poc-multi-assignment.spec.ts`

---

## Phase 7: User Story 5 - Querying Active Responsibilities and Assignment History (Priority: P4)

**Goal**: Provide read endpoints for active PoCs (enriched with employee display details and pending change flags) and paginated assignment history.

**Independent Test**: Call `GET /companies/:companyId/pocs` to retrieve active responsibilities with resolved employee names; call `GET /companies/:companyId/pocs/history` to audit past and pending changes.

### Tests for User Story 5
- [x] T026 [P] [US5] Unit test `PocQueryService` active list resolution and historical pagination in `src/modules/poc/services/poc-query.service.spec.ts`
- [x] T027 [P] [US5] Unit test `PocController` query endpoints in `src/modules/poc/controllers/poc.controller.spec.ts`

### Implementation for User Story 5
- [x] T028 [P] [US5] Create `QueryPocDto` with pagination and `pocType` filter in `src/modules/poc/dtos/query-poc.dto.ts`
- [x] T029 [US5] Implement `PocQueryService` with `findActiveByCompany` (joining `employee_references` and checking `isHolderInactive`) and `findHistoryByCompany` in `src/modules/poc/services/poc-query.service.ts`
- [x] T030 [US5] Implement `PocController.findActive` (`GET /companies/:companyId/pocs`) and `PocController.findHistory` (`GET /companies/:companyId/pocs/history`) with `@RequirePermission('poc:read')` in `src/modules/poc/controllers/poc.controller.ts`

**Checkpoint**: User Story 5 complete. Full operational visibility and historical audit trail accessible.

---

## Phase 8: Polish & Cross-Cutting Integration

**Purpose**: Module wiring, effective change consumer integration, and end-to-end regression validation

- [x] T031 Register `PocApplyHandler` in `src/modules/effective-change/effective-change.module.ts` and wire handler into execution consumer in `src/modules/effective-change/consumers/effective-change.consumer.ts`
- [x] T032 Wire `PocModule` and dependencies into `src/app.module.ts` (or main module)
- [x] T033 [P] End-to-end integration test suite validating initial assignment, replacement, deactivation, and query flows in `src/modules/poc/tests/poc-e2e.spec.ts`

---

## Dependencies & Execution Order

```
Phase 1: Setup (T001 - T003)
  │
  ▼
Phase 2: Foundational (T004 - T007)
  │
  ├───────────────────────────────────────────────────┐
  ▼                                                   ▼
Phase 3: US1 - Initial Assignment (T008 - T013) 🎯 MVP  Phase 7: US5 - Query Services (T026 - T030)
  │
  ▼
Phase 4: US2 - Replacement & History (T014 - T019)
  │
  ▼
Phase 5: US3 - Deactivation (T020 - T024)
  │
  ▼
Phase 6: US4 - Multi-Assignment (T025)
  │
  ▼
Phase 8: Polish & Integration (T031 - T033)
```

### Parallel Execution Opportunities
- **Setup & Foundational**: T001, T002, T005 can run in parallel.
- **Within US1**: DTO (T010) and unit test scaffolding (T008, T009) can run in parallel before service implementation (T011).
- **Within US2**: DTO (T016) and test scaffolding (T014, T015) can run in parallel.
- **US5 (Queries)**: Can be developed in parallel with US2/US3 once Foundational phase (T006) is complete.

---

## Implementation Strategy & MVP Scope

1. **MVP Scope (Phase 1 to Phase 3)**: Completing Tasks T001 through T013 delivers a functional MVP where Administrators can assign PoCs, satisfy Setup Step 8, and have assignments activated via the effective-dating engine.
2. **Incremental Delivery**:
   - Deliver MVP (US1) $\rightarrow$ Unblocks company setup Step 8.
   - Deliver Replacement (US2) $\rightarrow$ Enables operational role succession.
   - Deliver Deactivation (US3) $\rightarrow$ Enables clean role retirement.
   - Deliver Queries & Multi-Assignment (US4, US5) $\rightarrow$ Complete operational visibility and audit capabilities.
