# Research: Job Title Management

## Technical Decisions & Rationale

### 1. Module Architecture & Cross-Module Boundaries (ADR-14 & Principle I)

- **Decision**: `JobTitleModule` imports `DepartmentModule` and `GradeModule` to validate department and grade existence, tenant/company ownership, and active status via their respective exported repository or query service providers.
- **Rationale**: Direct database table queries across module boundaries violate Principle I and ADR-14. By querying through `DepartmentRepository` (or `DepartmentService`) and `GradeRepository` (or `GradeService`), we guarantee encapsulation and clean architecture layering.
- **Alternatives Considered**: Direct joins in `JobTitleRepository` SQL/TypeORM queries. Rejected because cross-module direct table access bypasses domain invariants and creates tight schema coupling across domain boundaries.

### 2. Mandatory Future Effective Dating & Company Timezone Cutoff

- **Decision**: Use `EffectiveDateUtil.validateFutureEffectiveDate(effectiveAtDate, company.timezone)` where `effectiveAt` $\ge$ end of current business day in the company's local timezone (fallback to UTC if unconfigured).
- **Rationale**: Aligns with existing Location, Department, and Grade domain implementations (`SET-F010`, `BR-10`, `BR-SET-F010-01`). Staging mutations with a future date prevents midday operational disruptions and ensures asynchronous execution coordination via the Go worker.
- **Alternatives Considered**: Allowing immediate active creations (now). Rejected because HR master data governance invariants require scheduled changes for auditability, downstream event synchronization, and organizational consistency.

### 3. REST API Routing Standardization & Context Resolution

- **Decision**: Standardize on root `/job-titles` endpoints (`POST /job-titles`, `GET /job-titles`, `GET /job-titles/:id`, `PATCH /job-titles/:id`, `POST /job-titles/:id/deactivate`). Tenant and company identifiers are extracted from `RequestContextService` and JWT auth headers (`@CurrentUser() authContext`).
- **Rationale**: Consistent with Grade and Department controllers (`@Controller('grades')`, `@Controller('departments')`), removing redundant `/companies/:companyId/job-titles` routing while maintaining strict multi-tenant/multi-company isolation via `@RequirePermission('job-title:*')` and request context resolution.
- **Alternatives Considered**: Nested routes `/companies/:companyId/job-titles`. Rejected for consistency with service-wide REST controller standards where company context is resolved through gateway context headers.

### 4. Single Pending Change per Entity Invariant (INV-007)

- **Decision**: Enforce at both application layer (checking `effectiveChangeRepository.findPendingChange(companyId, 'job_title', jobTitleId)`) and database layer (partial unique index `uq_effective_changes_one_pending_per_entity` on `(company_id, entity_type, entity_id)` where `status = 'scheduled'`).
- **Rationale**: Prevents conflicting scheduled updates/deactivations for the same job title before the prior pending change executes or gets cancelled.
- **Alternatives Considered**: Stacking multiple pending updates in a queue. Rejected because complex intermediate state resolution causes indeterministic operational state and race conditions during execution.

### 5. Setup Step 5 (JOB_TITLE) Completion Trigger

- **Decision**: When creating a Job Title in `scheduled` status, `CompanySetupStepRepository.markStepCompleted(tenantId, companyId, SetupStepType.JOB_TITLE, userId, manager)` is invoked atomically within the same database transaction.
- **Rationale**: Aligns with Setup Steps 2 (LOCATION), 3 (DEPARTMENT), and 4 (GRADE), satisfying FR-16, FR-17, and onboarding sequencing rules.
- **Alternatives Considered**: Marking step 5 completed only when the Job Title becomes `active`. Rejected because specifications explicitly state that scheduling the first Job Title satisfies Setup Step 5.

### 6. Asynchronous Execution Reconciliation via Go Worker & Kafka

- **Decision**:
  - Setting service publishes `setting.effective-change.scheduled` to Kafka via Transactional Outbox.
  - Go Worker (`setting-effective-worker-go`) schedules an Asynq task at `effectiveAt`.
  - Upon maturity, Go Worker publishes `setting.effective-change.execute` to Kafka without touching the database.
  - Setting service `EffectiveChangeConsumer` receives `setting.effective-change.execute`, enforces Redis idempotency (`SETNX setting:dedup:{eventId}`), and delegates to `JobTitleApplyHandler`.
  - `JobTitleApplyHandler` transitions state, verifies optimistic locking (`expectedUpdatedAt`), updates `effective_changes.status`, and writes downstream domain events (`setting.job-title.created`, `.updated`, `.deactivated`) to outbox for topic `setting.master-data.events`.
- **Rationale**: Polyrepo principle II and operational architecture invariant: Go worker handles zero database mutations; NestJS Setting Service owns all master data state transitions and outbox events.
