---
description: "Task list for Company Initialization at Tenant Provisioning"
---

# Tasks: Company Initialization at Tenant Provisioning

**Input**: Design documents from `/specs/003-company-init-provisioning/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`)

**Prerequisites**: `spec.md`, `plan.md`, `data-model.md`, `contracts/tenant-lifecycle-events.contract.json`

**Organization**: Tasks are grouped by user story (US1: Initial Company Provisioning, US2: Mandatory 8-Step Seeding, US3: Idempotent Event Consumption & Resilience).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Exact file paths included in each task

---

## Phase 1: Setup (Shared Infrastructure & Types)

**Purpose**: Establish shared event contracts, interfaces, and module scaffolding.

- [x] T001 [P] Create event payload interfaces and types in `src/kafka/types/tenant-lifecycle-events.types.ts`
- [x] T002 [P] Create `ConsumedEventEntity` in `src/modules/provisioning/entities/consumed-event.entity.ts`
- [x] T003 [P] Create `OutboxEventEntity` (or configure transactional outbox mapping) in `src/modules/company/entities/outbox-event.entity.ts`

---

## Phase 2: Foundational (Repositories & Data Access)

**Purpose**: Core data-access repositories required for atomic tenant provisioning and idempotency.

**⚠️ CRITICAL**: Must complete before user story domain logic implementation.

- [x] T004 [P] Create `TenantRepository` with upsert/existence lookup methods in `src/modules/tenant/repositories/tenant.repository.ts`
- [x] T005 [P] Create `CompanyRepository` with transactional persistence and tenant lookups in `src/modules/company/repositories/company.repository.ts`
- [x] T006 [P] Create `CompanySetupStepRepository` in `src/modules/company/repositories/company-setup-step.repository.ts`
- [x] T007 [P] Create `ConsumedEventRepository` with idempotency check and record methods in `src/modules/provisioning/repositories/consumed-event.repository.ts`
- [x] T008 Register repositories and entities in `TenantModule` (`src/modules/tenant/tenant.module.ts`) and `CompanyModule` (`src/modules/company/company.module.ts`)

**Checkpoint**: Foundation ready - repositories and schema bindings available for services.

---

## Phase 3: User Story 2 - Mandatory 8-Step Setup Seeding for Governance (Priority: P1)

**Goal**: Seed exactly 8 mandatory setup steps in fixed sequential order (1..8) and `INCOMPLETE` status for any newly initialized Company.

**Independent Test**: Execute `SetupStepSeederService.seedMandatorySteps(entityManager, tenantId, companyId)` and assert 8 step records created with matching enum types and order.

### Implementation for User Story 2

- [x] T009 [P] [US2] Create unit test for setup step seeder in `src/modules/company/services/setup-step-seeder.service.spec.ts`
- [x] T010 [US2] Implement `SetupStepSeederService` with the 8 sequential steps in `src/modules/company/services/setup-step-seeder.service.ts`
- [x] T011 [US2] Export `SetupStepSeederService` in `src/modules/company/index.ts` and declare provider in `src/modules/company/company.module.ts`

**Checkpoint**: Setup step seeding logic fully tested and available for company creation orchestration.

---

## Phase 4: User Story 1 - Automatic Initial Company Provisioning for New Tenants (Priority: P1) 🎯 MVP

**Goal**: Automatically provision a local tenant reference projection, initialize a single legal entity (`Company`) in `PENDING` status with registration metadata, trigger step seeding, and record outbox event within an atomic transaction.

**Independent Test**: Invoke `CompanyProvisioningService.provisionCompanyOnTenantCreated()` with sample tenant payload and assert atomic persistence of tenant, company (`PENDING`), 8 setup steps, and `company.created` outbox event.

### Implementation for User Story 1

- [x] T012 [P] [US1] Create unit tests for company provisioning command/service in `src/modules/company/services/company-provisioning.service.spec.ts`
- [x] T013 [US1] Implement `CompanyProvisioningService` (coordinating transaction, tenant projection upsert, company creation, seeder call, and outbox event) in `src/modules/company/services/company-provisioning.service.ts`
- [x] T014 [US1] Wire `CompanyProvisioningService` into `CompanyModule` (`src/modules/company/company.module.ts`)

**Checkpoint**: Company provisioning business logic fully operational and testable in isolation.

---

## Phase 5: User Story 3 - Idempotent and Resilient Provisioning Processing (Priority: P2)

**Goal**: Consume `tenant.lifecycle-events` Kafka topic for `tenant.created` and `tenant.provisioned` event types with idempotency deduplication and correlation context propagation.

**Independent Test**: Simulate Kafka event emission on `tenant.lifecycle-events` and assert successful provisioning; re-deliver same event ID and assert duplicate skip without error.

### Implementation for User Story 3

- [x] T015 [P] [US3] Create unit tests for Kafka consumer in `src/kafka/consumers/tenant-provisioning.consumer.spec.ts`
- [x] T016 [US3] Implement `TenantProvisioningConsumer` subscribing to `@EventPattern('tenant.lifecycle-events')` with RequestContext propagation and dedup in `src/kafka/consumers/tenant-provisioning.consumer.ts`
- [x] T017 [US3] Register `TenantProvisioningConsumer` and Kafka controller in `src/app.module.ts` (or `src/kafka/kafka.module.ts`)

**Checkpoint**: End-to-end event-driven consumption verified with idempotency and distributed context.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, E2E verification, and integration cleanup.

- [x] T018 [P] Add E2E / integration test for tenant provisioning lifecycle in `test/company-provisioning.e2e-spec.ts`
- [x] T019 Run validation per `specs/003-company-init-provisioning/quickstart.md`
- [x] T020 Run `pnpm lint` and `pnpm test` to verify code quality and coverage gates

---

## Dependencies & Execution Order

```
Phase 1: Setup (T001 - T003)
   │
   ▼
Phase 2: Foundational (T004 - T008)
   │
   ├──────────────────────────────┐
   ▼                              ▼
Phase 3: US2 Seeder (T009-T011)  Phase 5 Scaffolding (T015)
   │
   ▼
Phase 4: US1 Provisioning (T012 - T014)
   │
   ▼
Phase 5: US3 Kafka Consumer (T016 - T017)
   │
   ▼
Phase 6: Polish & E2E (T018 - T020)
```

### Parallel Opportunities

- **Setup Tasks**: T001, T002, T003 can run in parallel.
- **Foundational Repositories**: T004, T005, T006, T007 can be authored in parallel.
- **Test Authoring**: T009, T012, T015 can be drafted in parallel before service implementations.

---

## Implementation Strategy

### MVP First (User Story 2 & User Story 1)
1. Complete Setup (Phase 1) & Foundational Repositories (Phase 2).
2. Complete Step Seeder (Phase 3, US2) and Company Provisioning Service (Phase 4, US1).
3. Validate atomic company and setup steps creation via service unit tests.

### Incremental Delivery (Kafka Integration & Resilience)
1. Wire `TenantProvisioningConsumer` with `tenant.lifecycle-events` subscription and RequestContext wrapping (Phase 5, US3).
2. Execute E2E idempotency test and quickstart verification (Phase 6).
