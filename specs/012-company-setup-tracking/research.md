# Research & Technical Decisions: Mandatory Company Setup Sequence & Progress Tracking

## 1. Step Type & Sequence Modeling

- **Decision**: Define `SetupStepType` enum with all 8 mandatory setup steps:
  1. `COMPANY_INFORMATION` (Step 1)
  2. `LOCATION` (Step 2)
  3. `DEPARTMENT` (Step 3)
  4. `GRADE` (Step 4)
  5. `JOB_TITLE` (Step 5)
  6. `ROLE` (Step 6)
  7. `EMPLOYEE_IMPORT` (Step 7)
  8. `POC` (or `ORGANIZATION_RESPONSIBILITY` mapped via `POC`, Step 8)
- **Rationale**: Matches domain specification §8.3, §15, SET-F010, and existing schema `company_setup_steps`. The database entity `CompanySetupStepEntity` already exists and enforces `step_order BETWEEN 1 AND 8` along with unique constraints `(company_id, step_type)` and `(company_id, step_order)`.
- **Alternatives considered**: Dynamic checklist definitions in database tables. Rejected because the 8 steps are core hard-coded business invariants of company onboarding and activation readiness.

---

## 2. Local Master Data Completion Signaling & Atomic Transactions

- **Decision**: Implement `CompanySetupStepRepository.markStepCompleted` / `CompanySetupCommandService` accepting an optional TypeORM `EntityManager` to participate in callers' existing database transactions.
- **Rationale**: Setting modules (`CompanyService`, `LocationService`, `DepartmentService`, `GradeService`, `JobTitleService`, `PocService`) create and persist master data in atomic transactions (`TransactionService.runInTransaction`). Marking setup steps within that exact transaction guarantees zero inconsistency between entity persistence and checklist state.
- **Alternatives considered**: Async event loop within the same service (e.g. outbox event to mark step). Rejected because synchronous in-transaction marking provides immediate strong consistency for query consumers without delay.

---

## 3. External Setup Step Signals via Kafka & Idempotency

- **Decision**: Implement Kafka consumer `ExternalSetupStepConsumer` listening to topics:
  - `authorization.role-copy.completed` / `authorization.role-setup.completed` -> Marks Step 6 (`ROLE`) as `COMPLETED`.
  - `employee-import.batch.completed` -> Marks Step 7 (`EMPLOYEE_IMPORT`) as `COMPLETED`.
  Deduplication is achieved using Redis key `idemp:setup-step:${tenantId}:${companyId}:${eventType}:${eventId}` with a 24-hour TTL (or database-level idempotent status check fallback).
- **Rationale**: Authorization and Employee Import are independent polyrepo microservices. The Setting Service must never hold direct DB access or duplicate employee/role models; storing `external_reference_id` and metadata satisfies traceability without violating bounded contexts.
- **Alternatives considered**: Synchronous HTTP polling by Setting Service to external services during progress queries. Rejected because it introduces cross-service latency, coupling, and fragility.

---

## 4. Query Application Service & Activation Eligibility

- **Decision**: Expose `GET /companies/:id/setup` handled by `CompanySetupController` backed by `CompanySetupQueryService`.
- **Rationale**: Assembles the 8 steps ordered by `step_order` ASC, computes `totalSteps: 8`, `completedSteps` (count where `status === 'completed'`), `isEligibleForActivation` (`completedSteps === 8`), and lists `incompleteSteps`. Scoped strictly to `RequestContext.tenantId`.
- **Alternatives considered**: Returning progress embedded only in `GET /companies/:id`. A dedicated setup endpoint allows lightweight progress polling on onboarding UIs without querying full company profile projections.

---

## 5. Security & Authorization

- **Decision**: Decorate `CompanySetupController` with `@UseGuards(AuthGuard, PermissionGuard)` and `@RequirePermission('company:read')` (or Administrator / HR Business User permissions) and strictly enforce tenant isolation via `RequestContextService.getTenantCode()`.
- **Rationale**: In accordance with Constitution Principle VI, preventing cross-tenant data leaks and unauthorized state discovery.
