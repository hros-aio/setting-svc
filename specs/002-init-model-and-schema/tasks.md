# Tasks: Domain Model, TypeScript Interfaces & Schema Specification for Setting Service

**Input**: Design documents from `/specs/002-init-model-and-schema/`

**Prerequisites**: `plan.md`, `spec.md`, `data-model.md`, `contracts/events-and-contracts.md`, `research.md`, `quickstart.md`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story/domain module this task belongs to (`US1` to `US5`)
- Includes exact file paths in descriptions.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project structure and specification initialization

- [x] T001 Initialize feature directory and specification assets in `specs/002-init-model-and-schema/`
- [x] T002 [P] Verify `schema.sql` database file and PostgreSQL 18 compatibility in `schema.sql`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema and reference projections that block all domain entities

- [x] T003 Verify `tenants` reference projection table and constraints in `schema.sql`
- [x] T004 [P] Verify `employee_references` reference projection table and constraints in `schema.sql`
- [x] T005 [P] Verify core ENUM types (`company_status`, `setup_step_type`, `setup_step_status`, `master_data_status`, `change_operation`, `effective_change_status`) in `schema.sql`

---

## Phase 3: User Story 1 - Company & Onboarding Management (Priority: P1) 🎯 MVP

**Goal**: Model company boundaries, company template setup, 8-step onboarding workflows, TypeScript interfaces, and TypeORM entities

**Independent Test**: Verify company creation, company code tenant-uniqueness, template partial unique index, and 8-step setup constraints against PostgreSQL using `quickstart.md`

- [x] T006 [P] [US1] Define `Company` entity domain mapping, `ICompany` interface, `CompanyEntity` TypeORM class, and `CreateCompanyDto`/`UpdateCompanyDto` validation rules in `specs/002-init-model-and-schema/data-model.md`
- [x] T007 [P] [US1] Define `CompanySetupStep` entity domain mapping, `ICompanySetupStep` interface, `CompanySetupStepEntity` TypeORM class, and validation rules in `specs/002-init-model-and-schema/data-model.md`
- [x] T008 [US1] Document Company domain events (`company.created`, `company.activated`) in `specs/002-init-model-and-schema/contracts/events-and-contracts.md`
- [x] T009 [US1] Document Company activation lifecycle (`pending` -> `active`) and template copy-on-create rules in `specs/002-init-model-and-schema/spec.md`

---

## Phase 4: User Story 2 - Organizational Structure & Master Data (Priority: P2)

**Goal**: Model `Location`, `Department`, `Grade`, and `JobTitle` master data entities, including HQ constraints, department hierarchies, TypeScript interfaces, and TypeORM entities

**Independent Test**: Verify `uq_locations_one_headquarter_per_company` partial index and department self-parent prohibition check constraints using `quickstart.md`

- [x] T010 [P] [US2] Define `Location` entity mapping, `ILocation` interface, `LocationEntity` TypeORM class, `CreateLocationDto`/`UpdateLocationDto`, and HQ uniqueness rules in `specs/002-init-model-and-schema/data-model.md`
- [x] T011 [P] [US2] Define `Department` entity mapping, `IDepartment` interface, `DepartmentEntity` TypeORM class, `CreateDepartmentDto`/`UpdateDepartmentDto`, hierarchy parent reference, and self-parent check constraint in `specs/002-init-model-and-schema/data-model.md`
- [x] T012 [P] [US2] Define `Grade` and `JobTitle` entity mappings, TypeScript interfaces (`IGrade`, `IJobTitle`), TypeORM classes (`GradeEntity`, `JobTitleEntity`), DTOs, and department/grade cross-reference constraints in `specs/002-init-model-and-schema/data-model.md`
- [x] T013 [US2] Document Location, Department, Grade, and JobTitle domain events in `specs/002-init-model-and-schema/contracts/events-and-contracts.md`

---

## Phase 5: User Story 3 - Point of Contact (PoC) Assignments (Priority: P3)

**Goal**: Model company-scoped functional PoC assignments (`HR_HEAD`, `PAYROLL_OWNER`, etc.) linked to employee projections, including `IPoc` interface and `PocEntity`

**Independent Test**: Verify `uq_pocs_one_active_per_type` partial unique index using `quickstart.md`

- [x] T014 [P] [US3] Define `Point of Contact (PoC)` entity mapping, `IPoc` interface, `PocEntity` TypeORM class, `CreatePocDto`/`UpdatePocDto`, and single active assignment constraint in `specs/002-init-model-and-schema/data-model.md`
- [x] T015 [US3] Document `poc.assigned` domain event contract in `specs/002-init-model-and-schema/contracts/events-and-contracts.md`

---

## Phase 6: User Story 4 - Effective-Dated Change Processing (Priority: P4)

**Goal**: Model future-dated modifications (`UPDATE`, `DEACTIVATE`) via `effective_changes` and direct `CREATE` scheduled status on master tables, including `IEffectiveChange` interface and `EffectiveChangeEntity`

**Independent Test**: Verify `uq_effective_changes_one_pending_per_entity` partial unique index using `quickstart.md`

- [x] T016 [P] [US4] Define `EffectiveChange` entity mapping, `IEffectiveChange` interface, `EffectiveChangeEntity` TypeORM class, `ScheduleChangeDto`, status lifecycle (`scheduled` -> `applied`/`failed`), and payload structure in `specs/002-init-model-and-schema/data-model.md`
- [x] T017 [US4] Document effective-dated execution mechanics, direct scheduled master creation, and Go worker boundary rules in `specs/002-init-model-and-schema/research.md`

---

## Phase 7: User Story 5 - Multi-Tenancy & Cross-Service Event Integration (Priority: P5)

**Goal**: Document cross-service outbox integration events and multi-tenant security boundary enforcement

**Independent Test**: Execute full validation script scenarios in `quickstart.md`

- [x] T018 [P] [US5] Document CloudEvents payload schema for all outbound domain events in `specs/002-init-model-and-schema/contracts/events-and-contracts.md`
- [x] T019 [US5] Define inbound reference projection event contracts for `tenants` and `employee_references` in `specs/002-init-model-and-schema/contracts/events-and-contracts.md`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validate specification consistency across all generated artifacts

- [x] T020 Run cross-artifact analysis and verify consistency between `spec.md`, `data-model.md`, `plan.md`, and `schema.sql`
- [x] T021 [P] Validate SQL schema execution and multi-tenant constraint scenarios in `specs/002-init-model-and-schema/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) - BLOCKS all User Stories.
- **User Stories (Phases 3-7)**: Depend on Foundational (Phase 2) completion.
- **Polish (Phase 8)**: Depends on all User Stories completion.

### Parallel Opportunities
- T004, T005 in Phase 2 can run in parallel.
- T006, T007 in Phase 3 (US1) can run in parallel.
- T010, T011, T012 in Phase 4 (US2) can run in parallel.
- T014 in Phase 5 (US3), T016 in Phase 6 (US4), T018 in Phase 7 (US5) can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 & Phase 2.
2. Complete Phase 3 (Company & Onboarding).
3. Validate MVP using Scenario B in `quickstart.md`.

### Incremental Delivery
1. Add Phase 4 (Organizational Structure).
2. Add Phase 5 (PoC Assignments).
3. Add Phase 6 (Effective Changes).
4. Add Phase 7 (Cross-Service Events).
