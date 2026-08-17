---
description: "Task list for Company Activation feature implementation"
---

# Tasks: Company Activation

**Input**: Design documents from `/specs/013-company-activation/`  
**Prerequisites**: [plan.md](file:///home/ren0503/new-hros/admin-module/setting-svc/specs/013-company-activation/plan.md), [spec.md](file:///home/ren0503/new-hros/admin-module/setting-svc/specs/013-company-activation/spec.md), [data-model.md](file:///home/ren0503/new-hros/admin-module/setting-svc/specs/013-company-activation/data-model.md), [contracts/](file:///home/ren0503/new-hros/admin-module/setting-svc/specs/013-company-activation/contracts/company-activation.contract.md), [research.md](file:///home/ren0503/new-hros/admin-module/setting-svc/specs/013-company-activation/research.md)

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- All tasks reference explicit file paths

---

## Phase 1: Setup & Enums

**Purpose**: Shared event types and exception definitions

- [x] T001 [P] Ensure `COMPANY_ACTIVATED = 'company.activated'` is exported in `src/enums/event-type.enum.ts`
- [x] T002 [P] Create structured `CompanyActivationRejectedException` in `src/modules/company/exceptions/company-activation-rejected.exception.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Verify repository and query service readiness for activation transactions

- [x] T003 Ensure `CompanyRepository` has activation status and audit update support in `src/modules/company/repositories/company.repository.ts`
- [x] T004 Verify `CompanySetupQueryService.validateAllStepsCompleted` contract in `src/modules/company/services/company-setup-query.service.ts`

---

## Phase 3: User Story 1 - Explicit Company Activation by Administrator (Priority: P1) 🎯 MVP

**Goal**: Allow an authenticated Administrator to explicitly activate a company in `PENDING` status with all 8 setup steps completed, updating status to `ACTIVE` and writing an outbox event atomically.

**Independent Test**: Execute `ActivateCompany` workflow on a company with all 8 setup steps `COMPLETED`. Verify status flips to `ACTIVE`, audit metadata is populated, outbox event is stored, and HTTP 200 is returned.

### Implementation for User Story 1

- [x] T005 [US1] Implement `activateCompany` method with atomic transaction and outbox event creation in `src/modules/company/services/company.service.ts`
- [x] T006 [US1] Expose `POST /companies/:id/activate` endpoint in `src/modules/company/controllers/company.controller.ts`
- [x] T007 [P] [US1] Unit test `activateCompany` success path and outbox creation in `src/modules/company/services/company.service.spec.ts`
- [x] T008 [P] [US1] Unit test `POST /companies/:id/activate` endpoint in `src/modules/company/controllers/company.controller.spec.ts`

---

## Phase 4: User Story 2 - Rejection of Incomplete Setup Activation (Priority: P1)

**Goal**: Validate all 8 setup steps at request time and reject activation with HTTP 422 containing the list of incomplete step types if any steps are not `COMPLETED`.

**Independent Test**: Attempt activation on a company with incomplete steps (e.g. `DEPARTMENT`, `EMPLOYEE_IMPORT`). Verify rejection with 422 containing `incompleteSteps` array and that the company remains in `PENDING` status.

### Implementation for User Story 2

- [x] T009 [US2] Integrate `validateAllStepsCompleted` pre-check in `activateCompany` throwing `CompanyActivationRejectedException` in `src/modules/company/services/company.service.ts`
- [x] T010 [P] [US2] Unit test activation rejection on missing/incomplete setup steps in `src/modules/company/services/company.service.spec.ts`
- [x] T011 [P] [US2] Unit test controller response mapping for `CompanyActivationRejectedException` in `src/modules/company/controllers/company.controller.spec.ts`

---

## Phase 5: User Story 3 - Protection Against Invalid State Transitions & Unauthorized Access (Priority: P2)

**Goal**: Enforce tenant scoping, RBAC permissions, and reject re-activation attempts for companies that are already `ACTIVE`.

**Independent Test**: Attempt activation on an already `ACTIVE` company, a non-admin caller, or across tenants, and verify appropriate 422/403/404 errors.

### Implementation for User Story 3

- [x] T012 [US3] Add validation preventing re-activation of `ACTIVE` companies throwing `UnprocessableEntityException` in `src/modules/company/services/company.service.ts`
- [x] T013 [US3] Enforce `@RequirePermission('company:activate')` and tenant extraction on `POST /companies/:id/activate` in `src/modules/company/controllers/company.controller.ts`
- [x] T014 [P] [US3] Unit test already-active company rejection and tenant scoping in `src/modules/company/services/company.service.spec.ts`
- [x] T015 [P] [US3] Unit test guard protection and 404 behavior for unknown/cross-tenant IDs in `src/modules/company/controllers/company.controller.spec.ts`

---

## Phase 6: Polish & Quality Verification

**Purpose**: End-to-end test suite execution, linting, and export cleanliness

- [x] T016 [P] Export new exception from `src/modules/company/index.ts`
- [x] T017 Run full test suite and lint checks (`pnpm test`, `pnpm lint`)

---

## Dependencies & Execution Order

```
Phase 1: Setup (T001, T002)
  │
  ▼
Phase 2: Foundational (T003, T004)
  │
  ▼
Phase 3: User Story 1 (T005, T006, T007, T008) ───► MVP Checkpoint
  │
  ▼
Phase 4: User Story 2 (T009, T010, T011)
  │
  ▼
Phase 5: User Story 3 (T012, T013, T014, T015)
  │
  ▼
Phase 6: Polish & Verification (T016, T017)
```
