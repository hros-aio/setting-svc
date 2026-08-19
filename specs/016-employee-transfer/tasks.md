# Tasks: Employee Transfer Between Companies

**Input**: Design documents from `/specs/016-employee-transfer/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/employee-transfer.contract.md`, `quickstart.md`

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3], [US4])

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define event types, enums, table names, and module structure for the employee transfer domain

- [X] T001 [P] Add `AggregateType.EMPLOYEE_TRANSFER` in `src/enums/aggregate-type.enum.ts` and re-export in `src/enums/index.ts`
- [X] T002 [P] Add `TableName.EMPLOYEE_TRANSFERS` in `src/enums/table-name.enum.ts` and re-export in `src/enums/index.ts`
- [X] T003 [P] Add `EmployeeTransferEventType` (`setting.employee-transfer.events`, `employee.company-transferred`) in `src/enums/event-type.enum.ts` and re-export in `src/enums/index.ts`
- [X] T004 Initialize `EmployeeTransferModule` structure and barrel exports in `src/modules/employee-transfer/index.ts` and `src/modules/employee-transfer/employee-transfer.module.ts` and register in `src/app.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database migration, entity definitions, and repository layer required before implementing user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [P] Create TypeORM migration for `employee_transfers` table with partial unique index `uq_employee_pending_transfer` on `(tenant_id, employee_id) WHERE status = 'PENDING'` in `src/migrations/1724000000000-create-employee-transfers-table.ts`
- [X] T006 Define `EmployeeTransferEntity` with column mappings, company foreign keys, and unique constraint annotations in `src/modules/employee-transfer/entities/employee-transfer.entity.ts`
- [X] T007 Create `EmployeeTransferRepositoryInterface` and `EmployeeTransferRepository` implementation with tenant-scoped query methods (`findPendingByEmployeeId`, `findById`, `findHistoryByEmployeeId`, `save`) in `src/modules/employee-transfer/repositories/employee-transfer.repository.interface.ts` and `src/modules/employee-transfer/repositories/employee-transfer.repository.ts`
- [X] T008 Unit test `EmployeeTransferRepository` methods and partial unique constraint error handling in `src/modules/employee-transfer/repositories/employee-transfer.repository.spec.ts`

**Checkpoint**: Core persistence layer ready. User story implementation can now proceed.

---

## Phase 3: User Story 1 - Scheduling an Inter-Company Employee Transfer (Priority: P1) 🎯 MVP

**Goal**: Enable authenticated Administrators to schedule a pending inter-company transfer with a future effective date, persisting the transfer in `PENDING` status, staging a scheduling outbox event, and maintaining active attribution under the source company.

**Independent Test**: Submit `POST /tenants/:tenantId/companies/:companyId/employees/:employeeId/transfers` with a valid destination company and future date; verify `employee_transfers` record created with status `PENDING`, `setting.effective-change.scheduled` outbox event staged, and `employee_references` attribution unchanged.

### Tests for User Story 1
- [X] T009 [P] [US1] Unit test `EmployeeTransferService.initiateTransfer` transactional workflow and outbox scheduling in `src/modules/employee-transfer/services/employee-transfer.service.spec.ts`
- [X] T010 [P] [US1] Unit test `EmployeeTransferController.initiateTransfer` endpoint and parameter validation in `src/modules/employee-transfer/controllers/employee-transfer.controller.spec.ts`

### Implementation for User Story 1
- [X] T011 [P] [US1] Create `InitiateEmployeeTransferDto` with `class-validator` rules for `destinationCompanyId`, `effectiveAt`, and optional destination master data IDs in `src/modules/employee-transfer/dtos/initiate-employee-transfer.dto.ts`
- [X] T012 [P] [US1] Create `EmployeeTransferResponseDto` in `src/modules/employee-transfer/dtos/employee-transfer-response.dto.ts`
- [X] T013 [US1] Implement `EmployeeTransferService.initiateTransfer` method executing transactional persistence of `employee_transfers` row and `setting.effective-change.scheduled` outbox event in `src/modules/employee-transfer/services/employee-transfer.service.ts`
- [X] T014 [US1] Implement `EmployeeTransferController.initiateTransfer` endpoint `POST /tenants/:tenantId/companies/:companyId/employees/:employeeId/transfers` protected by `AuthGuard`, `PermissionGuard`, and `@RequirePermission('employee-transfer:create')` in `src/modules/employee-transfer/controllers/employee-transfer.controller.ts`

**Checkpoint**: User Story 1 functional and independently testable as the core MVP.

---

## Phase 4: User Story 2 - Automated Execution & Continuous Employment Attribution Transition (Priority: P1)

**Goal**: Automatically execute pending transfers upon reaching `effectiveAt`, switching active employee attribution (`employee_references.company_id`) to the destination company, marking transfer `COMPLETED`, preserving historical continuous employment, and publishing downstream synchronization events.

**Independent Test**: Execute `EmployeeTransferApplyHandler` for a pending transfer reaching `effectiveAt`; verify transfer status transitions to `COMPLETED`, `employee_references.company_id` is updated, historical records remain intact, and `employee.company-transferred` outbox event is emitted.

### Tests for User Story 2
- [X] T015 [P] [US2] Unit test `EmployeeTransferApplyHandler` apply execution, attribution update, and outbox event emission in `src/modules/effective-change/handlers/employee-transfer-apply.handler.spec.ts`
- [X] T016 [P] [US2] Unit test Redis execution deduplication and idempotency checks in `src/modules/employee-transfer/services/employee-transfer.service.spec.ts`

### Implementation for User Story 2
- [X] T017 [US2] Implement `EmployeeTransferApplyHandler` in `src/modules/effective-change/handlers/employee-transfer-apply.handler.ts` to execute pending transfers upon `setting.effective-change.execute` callbacks, updating `employee_references.company_id`, marking transfer status as `COMPLETED`, and staging outbox event `employee.company-transferred`
- [X] T018 [US2] Register `EmployeeTransferApplyHandler` in `src/modules/effective-change/effective-change.module.ts`
- [X] T019 [US2] Implement `EmployeeTransferService.executeTransfer` with Redis `SETNX` deduplication (`transfer:exec:{id}`), continuous employment preservation, and status transition in `src/modules/employee-transfer/services/employee-transfer.service.ts`

**Checkpoint**: User Story 2 complete. Automated execution and continuous employment transition operational.

---

## Phase 5: User Story 3 - Destination Master Data & Company Status Verification (Priority: P2)

**Goal**: Enforce strict validation rules before transfer initiation: destination company must be `ACTIVE`, destination master data (Location, Department, Grade, Job Title) must belong exclusively to the destination company and be `ACTIVE`, and `effectiveAt` must be $\ge$ end of current business day.

**Independent Test**: Attempt to initiate transfers with: (1) an inactive destination company, (2) a Job Title belonging to a different company, or (3) past/today effective date; verify all requests are rejected with explicit HTTP 400/404/422 errors.

### Tests for User Story 3
- [X] T020 [P] [US3] Unit test `ValidateTransferRequestService` covering destination company status, master data isolation, date boundaries, and existing pending transfer checks in `src/modules/employee-transfer/services/validate-transfer-request.service.spec.ts`

### Implementation for User Story 3
- [X] T021 [US3] Implement `ValidateTransferRequestService` verifying destination company `ACTIVE` status, employee source company attribution, single-pending invariant, active destination master data scoping, and `effectiveAt >= endOfCurrentBusinessDay` in `src/modules/employee-transfer/services/validate-transfer-request.service.ts`
- [X] T022 [US3] Integrate `ValidateTransferRequestService` into `EmployeeTransferService.initiateTransfer` pipeline in `src/modules/employee-transfer/services/employee-transfer.service.ts`

**Checkpoint**: User Story 3 complete. Multi-company data isolation and date boundary validation enforced.

---

## Phase 6: User Story 4 - Querying Pending Transfers and Employment Transfer Audit History (Priority: P3)

**Goal**: Provide query endpoints for authorized Administrators and Auditors to fetch the active pending transfer and the full chronological transfer audit history for any employee.

**Independent Test**: Call `GET .../transfers/pending` to verify current pending transfer details; call `GET .../transfers/history` to verify chronological list of all past transfers and company tenures.

### Tests for User Story 4
- [X] T023 [P] [US4] Unit test `EmployeeTransferQueryService` for `findPendingByEmployee` and `findHistoryByEmployee` queries in `src/modules/employee-transfer/services/employee-transfer-query.service.spec.ts`
- [X] T024 [P] [US4] Unit test query endpoints in `src/modules/employee-transfer/controllers/employee-transfer.controller.spec.ts`

### Implementation for User Story 4
- [X] T025 [P] [US4] Create `QueryEmployeeTransferDto` with pagination parameters (`limit`, `offset`) in `src/modules/employee-transfer/dtos/query-employee-transfer.dto.ts`
- [X] T026 [US4] Implement `EmployeeTransferQueryService` retrieving pending transfer and historical transfer timeline in `src/modules/employee-transfer/services/employee-transfer-query.service.ts`
- [X] T027 [US4] Implement `EmployeeTransferController` endpoints `GET /tenants/:tenantId/companies/:companyId/employees/:employeeId/transfers/pending` and `GET /tenants/:tenantId/employees/:employeeId/transfers/history` with `@RequirePermission('employee-transfer:read')` in `src/modules/employee-transfer/controllers/employee-transfer.controller.ts`

**Checkpoint**: User Story 4 complete. Full transfer visibility and audit tracking enabled.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: API documentation, end-to-end integration tests, and static quality validation

- [X] T028 [P] Add Swagger / OpenAPI documentation decorators for all transfer DTOs, query parameters, and endpoints in `src/modules/employee-transfer/controllers/employee-transfer.controller.ts`
- [X] T029 Integration test end-to-end transfer lifecycle (initiation, validation errors, duplicate conflict, apply execution, and history queries) against PostgreSQL in `test/employee-transfer.e2e-spec.ts`
- [X] T030 Run type-checking (`tsc --noEmit`), linting (`pnpm lint`), and verify test suite passes per `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
  │
  └──► Phase 2: Foundational (Database Migration & Repository)
         │
         ├──► Phase 3: User Story 1 (Initiate Transfer & Outbox Scheduling) 🎯 MVP
         │      │
         │      ├──► Phase 4: User Story 2 (Execution & Continuous Attribution Transition)
         │      │
         │      └──► Phase 5: User Story 3 (Master Data Isolation & Precondition Validation)
         │             │
         │             └──► Phase 6: User Story 4 (Query Pending & Audit History)
         │                    │
         └────────────────────┴──► Phase 7: Polish & Cross-Cutting Concerns
```

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2. Core MVP for initiating pending transfers.
- **User Story 2 (P1)**: Depends on Phase 2 & US1. Handles automated execution and attribution transition.
- **User Story 3 (P2)**: Integrates into US1 initiation pipeline to provide comprehensive destination verification.
- **User Story 4 (P3)**: Depends on Phase 2 repository queries; exposes read endpoints for pending and historical transfers.

---

## Parallel Opportunities

- **Phase 1 (Setup)**: Tasks `T001`, `T002`, `T003` can execute in parallel.
- **Phase 2 (Foundational)**: `T005` (migration) and `T006` (entity) can be drafted in parallel.
- **Phase 3 (US1)**: Test tasks `T009`, `T010` and DTO tasks `T011`, `T012` can run in parallel before service implementation `T013`.
- **Phase 4 (US2)**: Test tasks `T015`, `T016` can run in parallel.
- **Phase 5 (US3)**: Test task `T020` can run before service implementation `T021`.
- **Phase 6 (US4)**: Test tasks `T023`, `T024` and DTO task `T025` can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 & Foundational)

1. Complete **Phase 1: Setup** (Enums & Module initialization).
2. Complete **Phase 2: Foundational** (Migration, Entity, Repository).
3. Complete **Phase 3: User Story 1** (Initiation DTOs, Service, Controller, Outbox staging).
4. **Validate MVP**: Test transfer scheduling via `POST .../transfers` and verify database row & outbox event.

### Incremental Delivery

1. Add **User Story 2**: Worker apply handler & attribution transition (`COMPLETED` status & `employee.company-transferred`).
2. Add **User Story 3**: Strict destination master data and future-date verification.
3. Add **User Story 4**: Query endpoints for pending transfer and historical timeline.
4. Run **Phase 7: Polish**: Swagger annotations, E2E integration test, and lint/typecheck quality gates.
