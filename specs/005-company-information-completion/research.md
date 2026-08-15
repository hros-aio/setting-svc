# Phase 0 Research: Company Information Completion Technical Decisions

## Decision 1: Service Orchestration & Transactional Boundary

- **Decision**: Encapsulate company information updates within `CompanyService.updateCompanyInformation` wrapped in a single PostgreSQL database transaction using `TransactionService.runInTransaction` (or `EntityManager`).
- **Rationale**: Persisting updated company profile fields to `companies`, updating completion audit attributes (`information_completed_at`, `information_completed_by`), transitioning the `COMPANY_INFORMATION` setup step to `COMPLETED` in `company_setup_steps`, and writing the `company.updated` event to `outbox_events` must all commit or rollback atomically.
- **Alternatives Considered**:
  - *Separate endpoint calls (one for company info, one for step completion)*: Rejected because client failures or network interruptions could leave company info updated without marking the setup step complete, stalling company onboarding progression.
  - *Asynchronous outbox-driven self-consumption for step completion*: Rejected because setup step status is synchronous local state within the Setting Service domain and should be updated immediately for the caller.

---

## Decision 2: Setup Step 1 (COMPANY_INFORMATION) State Transition & Idempotence

- **Decision**: When saving company information:
  1. If Setup Step 1 (`COMPANY_INFORMATION`) is currently `INCOMPLETE`, transition `status = COMPLETED`, `completed_at = NOW()`, `completed_by = RequestContext.userId`.
  2. If Setup Step 1 is already `COMPLETED` (e.g., subsequent profile updates on an active or already configured company), preserve `COMPLETED` status and do not overwrite the original `completed_at` timestamp unless explicitly requested.
- **Rationale**: Allows administrators to update profile attributes anytime in both `PENDING` and `ACTIVE` states without causing state machine errors, constraint violations, or resetting onboarding progression.
- **Alternatives Considered**:
  - *Throw error if step is already completed*: Rejected because companies must be able to update their legal name, tax ID, or timezone post-activation.
  - *Reset step to incomplete on any update*: Rejected because it would invalidate company activation requirements.

---

## Decision 3: Mandatory Field Criteria for Step 1 Completion (BQ-005 / Architecture §31)

- **Decision**: Require baseline attributes (`legalName` or `displayName`/`name`, `countryCode`, `currencyCode`, `timezone`) to mark Setup Step 1 as `COMPLETED`. Optional metadata (`registrationNumber`, `taxRegistrationNumber`, `legalAddress`, `locale`) can be saved whenever available.
- **Rationale**: Complies with BR-3 (pre-filled data from registration is valid) while ensuring foundational organizational parameters are set before downstream setup steps (locations, departments, grades) are configured.
- **Alternatives Considered**:
  - *Strictly require Tax ID and Legal Address for all companies*: Rejected because certain entity types or staging organizations may not immediately have tax registration numbers during initial company creation.

---

## Decision 4: Event Emission & Outbox Contract

- **Decision**: Write an outbox event with `eventType: 'company.updated'`, `aggregateType: 'COMPANY'`, and payload containing updated company details, tenant ID, and actor info to `outbox_events` table.
- **Rationale**: Downstream microservices (Employee Service, Payroll Service, Notification Service) consume `company.updated` to synchronize local cache or tenant context asynchronously without tight HTTP coupling.
- **Alternatives Considered**:
  - *Direct Kafka publishing inside HTTP request handler*: Rejected per Constitution Principle II & V; non-transactional Kafka publishing risks dual-write inconsistencies if the database transaction fails after event publish.

---

## Decision 5: Idempotency Key Handling & Caching

- **Decision**: Support the HTTP `Idempotency-Key` header at the controller level using Redis `CacheService` with a 24-hour TTL (cache key pattern: `idempotency:company-update:{tenantId}:{companyId}:{idempotencyKey}`).
- **Rationale**: Prevents duplicate database mutations, outbox event generation, or audit timestamp churn on client network retries.
