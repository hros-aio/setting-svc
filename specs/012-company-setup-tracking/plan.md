# Implementation Plan: Mandatory Company Setup Sequence & Progress Tracking

**Branch**: `012-company-setup-tracking` | **Spec**: [spec.md](./spec.md)

## Technical Context

The Setting Service (`setting-service-api`) is the single source of truth for Company onboarding setup progress. During company provisioning, 8 mandatory setup steps are initialized in `company_setup_steps` table in `INCOMPLETE` status. Internal master data modules (Company Information, Location, Department, Grade, Job Title, Point of Contact) signal step completion atomically within their database transactions. External domain milestones (Authorization Role copy/setup and Employee Import batches) are consumed asynchronously via Kafka topics and updated idempotently with external reference tracking.

- **Framework**: NestJS (TypeScript `strict: true`), TypeORM, PostgreSQL 18
- **Messaging**: Kafka (`@nestjs/microservices`), `@new-hros/libs-events`, Transactional Outbox
- **Persistence & Entities**: `CompanySetupStepEntity` (`company_setup_steps`), `CompanyEntity` (`companies`)
- **Shared Libraries**: `@new-hros/libs-core` (RequestContext, CacheService), `@new-hros/libs-apis` (AuthGuard, PermissionGuard), `@new-hros/libs-sql` (TransactionService)

---

## Constitution Check

- [x] **Principle I: Clean Architecture Layering & Module Boundaries** - Transport (Controller) -> Business Service -> Repository. No direct DB queries in controllers.
- [x] **Principle II: Polyrepo Architecture & Cross-Service Contracts** - Asynchronous Kafka events consumed for external domains (Roles and Employee Import) with no direct database coupling.
- [x] **Principle III: TypeScript Rigor & Naming Standards** - Strict type checking, explicit return types on all methods, kebab-case file naming matching directory structures.
- [x] **Principle IV: Testing Discipline & Quality Gates** - Comprehensive unit and integration test coverage with AAA structure.
- [x] **Principle V: Database Integrity, Transactions & Migrations** - In-transaction step completion updates, unique constraints `(company_id, step_type)` and `(company_id, step_order)`, audit timestamps.
- [x] **Principle VI: Security, Authentication & Observability** - Multi-tenant isolation enforced by `RequestContext.tenantId`, RS256 JWT auth, role/permission guards.
- [x] **Principle VII: Performance, Caching & Scalability** - Local DB reads for progress queries without cross-service network blocking, Redis deduplication for Kafka events.

---

## Phase 0: Outline & Research

All key technical decisions and architectural evaluations have been documented in [`research.md`](./research.md):
- Enum definitions and sequence order (1-8) matching domain specifications.
- In-transaction atomic step completion for internal master data modules.
- Asynchronous Kafka consumers for external domain signals (`ROLE`, `EMPLOYEE_IMPORT`) with Redis idempotency.
- Dedicated query service and controller endpoint (`GET /companies/:id/setup`) returning activation readiness.

---

## Phase 1: Design & Contracts

- **Data Model**: Detailed in [`data-model.md`](./data-model.md).
- **Interface Contracts**: REST endpoint schema and Kafka event payloads defined in [`contracts/setup-progress.contract.md`](./contracts/setup-progress.contract.md).
- **Quickstart Guide**: Validation workflows defined in [`quickstart.md`](./quickstart.md).

---

## Phase 2: Implementation Breakdown & Work Packages

### Task 1: Setup Step Persistence & Repository Enhancements (BE-01)
- Verify and ensure `CompanySetupStepRepository` methods:
  - `findStepsByCompanyId(companyId: string, manager?: EntityManager)`
  - `findByCompanyAndStep(companyId: string, stepType: SetupStepType, manager?: EntityManager)`
  - `markStepCompleted(tenantId: string, companyId: string, stepType: SetupStepType, completedBy?: string, metadata?: Record<string, unknown>, externalReferenceId?: string, manager?: EntityManager)`
- Unit tests for repository methods and constraints.

### Task 2: Internal Step Completion Command Service (BE-02)
- Implement / refine internal step completion methods in `CompanySetupCommandService` or repository to be called by `CompanyService`, `LocationService`, `DepartmentService`, `GradeService`, `JobTitleService`, and `PocService`.
- Verify template copy marks copied steps as `COMPLETED` with `{ "completedViaCopy": true }`.
- Unit tests verifying in-transaction status transitions and idempotency.

### Task 3: External Event Consumers for Roles and Employee Import (BE-03)
- Implement / update `RoleCopyCompletedConsumer` and `EmployeeImportCompletedConsumer` (or unified `ExternalSetupStepConsumer`).
- Add Redis key deduplication `idemp:setup-step:${tenantId}:${companyId}:${eventType}:${eventId}`.
- Transition `ROLE` (Step 6) and `EMPLOYEE_IMPORT` (Step 7) to `COMPLETED` storing `externalReferenceId` and metadata.
- Unit tests for consumer handling, idempotency, and error handling.

### Task 4: Setup Progress Query Service & Activation Eligibility (BE-04)
- Implement `CompanySetupQueryService.getCompanySetupProgress(tenantCodeOrId: string, companyId: string)`.
- Compute `totalSteps`, `completedSteps`, `isEligibleForActivation`, and `incompleteSteps`.
- Unit tests for all combination of step completions and tenant scoping.

### Task 5: Setup Progress REST Controller & API Exposure (BE-05)
- Expose `GET /companies/:id/setup` on `CompanyController` (or `CompanySetupController`).
- Decorate with `@UseGuards(AuthGuard, PermissionGuard)`, `@RequirePermission('company:read')`.
- Map response to standard API response envelope format.
- Controller unit tests and e2e integration tests.
