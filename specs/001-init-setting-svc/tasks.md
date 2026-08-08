---
description: "Task list for Init Setting Service Infrastructure"
---

# Tasks: Init Setting Service Infrastructure

**Input**: Design documents from `/specs/001-init-setting-svc/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/health.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic repository configuration

- [x] T001 Initialize NestJS application with TypeScript and pnpm package dependencies in package.json
- [x] T002 [P] Configure ESLint rules and Prettier formatting in .eslintrc.js and .prettierrc
- [x] T003 [P] Configure TypeScript compiler options in tsconfig.json with strict mode enabled

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T004 Create InfrastructureConfig class and configuration loader in src/config/infrastructure.config.ts
- [x] T005 [P] Setup environment variable validation schema using class-validator in src/config/infrastructure.config.ts
- [x] T006 Configure AppLogger and global filter/interceptors in src/app.module.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Service Bootstrap & Health Verification (Priority: P1) 🎯 MVP

**Goal**: Expose `/setting-api/health` health check endpoint and enforce global `/setting-api` route prefix across all HTTP endpoints.

**Independent Test**: Send GET request to `http://localhost:3000/setting-api/health` and verify HTTP 200 OK response payload containing health status metrics.

### Implementation for User Story 1

- [x] T007 [P] [US1] Create HealthStatus DTO and response interfaces in src/modules/health/dto/health-status.dto.ts
- [x] T008 [US1] Implement HealthService handling subsystem health status aggregation in src/modules/health/services/health.service.ts
- [x] T009 [US1] Implement HealthController with GET /health route handler in src/modules/health/controllers/health.controller.ts
- [x] T010 [P] [US1] Create HealthModule barrel and provider export in src/modules/health/health.module.ts and src/modules/health/index.ts
- [x] T011 [US1] Configure global route prefix setting-api and bootstrap NestJS app in src/main.ts
- [x] T012 [P] [US1] Add E2E health check contract test in test/health.e2e-spec.ts

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Shared Infrastructure Connections & Lifecycle Management (Priority: P2)

**Goal**: Establish resilient PostgreSQL (TypeORM) and Redis (CacheManager) connections on app startup and cleanly drain them on shutdown.

**Independent Test**: Bootstrap service with active database and cache containers, verify active connections, and trigger SIGTERM to verify graceful shutdown without resource leaks.

### Implementation for User Story 2

- [x] T013 [P] [US2] Configure TypeORM async connection provider in src/config/database.config.ts
- [x] T014 [P] [US2] Configure Redis CacheManager provider from @hrms/libs-core in src/config/cache.config.ts
- [x] T015 [US2] Import TypeOrmModule and CacheModule into main application module in src/app.module.ts
- [x] T016 [US2] Enable shutdown hooks (app.enableShutdownHooks()) for SIGTERM/SIGINT signal handling in src/main.ts
- [x] T017 [US2] Integrate database and cache health indicators into HealthService in src/modules/health/services/health.service.ts

**Checkpoint**: User Story 1 and User Story 2 are both complete and independently testable.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, cleanup, and validation against quickstart scenarios

- [x] T018 Validate all end-to-end quickstart scenarios in specs/001-init-setting-svc/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS User Stories.
- **User Story 1 (Phase 3)**: Depends on Foundational phase.
- **User Story 2 (Phase 4)**: Depends on Foundational phase and integrates with User Story 1 health check.
- **Polish (Phase 5)**: Depends on User Story 1 and User Story 2 completion.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1).
3. Test GET `/setting-api/health` independently to confirm MVP availability.
