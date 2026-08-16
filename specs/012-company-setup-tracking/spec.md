# Feature Specification: Mandatory Company Setup Sequence & Progress Tracking

**Feature Branch**: `012-company-setup-tracking`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "Breaking BE Tasks: Mandatory Company Setup Sequence & Progress Tracking - Establish, persist, independently track, and query the completion status of the 8 mandatory organizational setup steps for any Company in PENDING status. Provide synchronous progress read APIs and handle asynchronous completion signals from external services (Authorization and Employee Import) without violating domain data boundaries."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Query Company Setup Progress and Readiness (Priority: P1)

As a Tenant Administrator or HR Business User, I want to query the real-time setup completion progress of any company in my tenant across all 8 mandatory setup steps, so that I can monitor onboarding status, identify which steps remain incomplete, and verify if the company is eligible for activation.

**Why this priority**: Core user-facing visibility capability. Administrators and onboarding workflows rely on this query to understand onboarding state, guide users through incomplete steps, and determine when a company can be activated.

**Independent Test**: Can be tested independently by creating or fetching a company, executing `GET /companies/:id/setup`, and verifying that all 8 steps with their respective sequence orders, statuses (`INCOMPLETE` or `COMPLETED`), timestamps, attribution, and overall activation eligibility (`isEligibleForActivation`) are correctly calculated and returned.

**Acceptance Scenarios**:

1. **Given** an authenticated Administrator and a Company in `PENDING` status with 3 completed steps (e.g., Company Info, Location, Department) and 5 incomplete steps, **When** they request setup progress via `GET /companies/:id/setup`, **Then** the response returns HTTP 200 with `totalSteps: 8`, `completedSteps: 3`, `isEligibleForActivation: false`, the list of 5 `incompleteSteps`, and the ordered list of all 8 steps (1 to 8) with their respective completion details.
2. **Given** a Company where all 8 mandatory setup steps have been completed, **When** an Administrator queries setup progress, **Then** the response indicates `totalSteps: 8`, `completedSteps: 8`, `isEligibleForActivation: true`, and an empty `incompleteSteps` array.
3. **Given** an authenticated user belonging to Tenant A, **When** they attempt to query setup progress for a Company belonging to Tenant B, **Then** the system rejects the request with HTTP 404 Not Found or HTTP 403 Forbidden without leaking company presence.

---

### User Story 2 - Local Setting Master Data Step Completion Signaling (Priority: P1)

As the Setting Service domain engine, I want internal Setting modules (Company Info, Location, Department, Grade, Job Title, Organization Responsibility / PoC) to atomically mark their corresponding setup step as `COMPLETED` within their write transactions upon entity creation or copy, so that step completion status is guaranteed consistent with actual master data persistence.

**Why this priority**: Foundational internal mechanism ensuring zero state drift between entity creation/copying and onboarding checklist state without requiring external polling or distributed sagas.

**Independent Test**: Can be tested independently by invoking the setup step completion method within a database transaction for any Setting-owned step (e.g., `LOCATION`, `GRADE`), verifying that the corresponding step row transitions to `COMPLETED` with timestamp and user attribution, and verifying idempotent behavior on subsequent invocations.

**Acceptance Scenarios**:

1. **Given** a Company with step `LOCATION` in `INCOMPLETE` status, **When** the first Location is created (or copied) within a database transaction, **Then** setup step 2 (`LOCATION`) is updated to `COMPLETED` with `completed_at` set to current timestamp and `completed_by` attributed to the acting user.
2. **Given** a newly created Company that copies Grades and Job Titles from Default Company during provisioning, **When** the copy transaction executes, **Then** step 4 (`GRADE`) and step 5 (`JOB_TITLE`) are marked `COMPLETED` automatically with metadata indicating completion via template copy.
3. **Given** a setup step that is already marked `COMPLETED`, **When** another entity for that step is created or the completion method is invoked again, **Then** the operation succeeds idempotently without throwing errors or altering original completion timestamps.

---

### User Story 3 - Asynchronous External Step Completion Signals (Roles & Employee Import) (Priority: P2)

As the Setting Service integration engine, I want to consume asynchronous completion events emitted by external domain services (Authorization Service for Role setup/copy and Employee Import Service for batch imports) to mark Step 6 (`ROLE`) and Step 7 (`EMPLOYEE_IMPORT`) as completed, so that cross-domain onboarding progress is tracked accurately without violating domain data boundaries.

**Why this priority**: Essential for multi-domain onboarding tracking where master data (Roles, Permissions, Employee records) is owned by external microservices rather than the Setting Service.

**Independent Test**: Can be tested independently by publishing mock Kafka events for `authorization.role-copy.completed` and `employee-import.batch.completed` and verifying that Steps 6 and 7 in `company_setup_steps` transition to `COMPLETED` with external reference IDs and metadata, while duplicate messages are ignored via deduplication.

**Acceptance Scenarios**:

1. **Given** a Company with step `ROLE` in `INCOMPLETE` status, **When** an `authorization.role-copy.completed` event is received from the message bus, **Then** step 6 (`ROLE`) transitions to `COMPLETED` and stores the external role batch ID and metadata.
2. **Given** a Company with step `EMPLOYEE_IMPORT` in `INCOMPLETE` status, **When** an `employee-import.batch.completed` event is received, **Then** step 7 (`EMPLOYEE_IMPORT`) transitions to `COMPLETED` and stores the external import batch reference.
3. **Given** a duplicate delivery of an external completion event, **When** processed by the event consumer, **Then** the system detects the duplicate via idempotency tracking (e.g., Redis key with 24-hour TTL), skips redundant database writes, and acknowledges the message.
4. **Given** a malformed external event or non-existent company reference, **When** received by the consumer, **Then** the message is routed to a dead-letter topic (DLT) without crashing the consumer.

---

### User Story 4 - Company Setup Step Initialization on Provisioning (Priority: P2)

As the Setting Service provisioning engine, I want all 8 mandatory setup steps to be automatically initialized in `INCOMPLETE` status with predetermined sequence orders (1 to 8) whenever a new Company is created, so that every Company has a deterministic and complete setup tracking checklist from inception.

**Why this priority**: Guarantees data integrity and prevents null/missing step errors during subsequent progress queries or activation checks.

**Independent Test**: Can be tested independently by provisioning a new Company and querying the database to ensure exactly 8 step records exist with sequential order 1 through 8 and `INCOMPLETE` status.

**Acceptance Scenarios**:

1. **Given** a new Company created in `PENDING` status, **When** the company creation transaction commits, **Then** exactly 8 `company_setup_steps` records are created for that company with step types: `COMPANY_INFORMATION` (1), `LOCATION` (2), `DEPARTMENT` (3), `GRADE` (4), `JOB_TITLE` (5), `ROLE` (6), `EMPLOYEE_IMPORT` (7), `ORGANIZATION_RESPONSIBILITY` (8).
2. **Given** an attempt to insert a duplicate step type for the same company, **When** executed against the database, **Then** the operation is rejected by unique constraint `uq_company_setup_steps_step`.

---

### Edge Cases

- What happens if an external domain event arrives before the local company provisioning transaction commits? The consumer retries with exponential backoff or dead-letter queuing to ensure eventual consistency.
- What happens if a step is updated concurrently by multiple requests? The repository utilizes database-level upsert/transactional locking scoped by `(tenant_id, company_id, step_type)` to ensure consistent state.
- What happens if an entity (e.g., all Locations) is deleted after a step was marked completed? Setup steps represent onboarding milestones completed at least once during setup; status remains `COMPLETED` unless a dedicated explicit step reset flow is invoked.
- What happens if a progress query is requested for a deleted or non-existent company? The service returns a 404 Not Found response.
- What happens if corrupted data results in missing step records (< 8 steps)? The progress evaluator identifies the anomaly, logs a structured error, and flags the company as ineligible for activation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST establish and track exactly 8 mandatory setup steps for every Company:
  1. `COMPANY_INFORMATION` (Step Order: 1)
  2. `LOCATION` (Step Order: 2)
  3. `DEPARTMENT` (Step Order: 3)
  4. `GRADE` (Step Order: 4)
  5. `JOB_TITLE` (Step Order: 5)
  6. `ROLE` (Step Order: 6)
  7. `EMPLOYEE_IMPORT` (Step Order: 7)
  8. `ORGANIZATION_RESPONSIBILITY` (Step Order: 8)
- **FR-002**: System MUST initialize all 8 setup steps in `INCOMPLETE` status when a new Company is created.
- **FR-003**: System MUST enforce uniqueness of `(company_id, step_type)` across all setup step records.
- **FR-004**: System MUST strictly isolate setup steps by `tenant_id` on all read and write queries.
- **FR-005**: System MUST provide an internal transactional command service allowing Setting modules to mark internal steps (1, 2, 3, 4, 5, 8) as `COMPLETED` with timestamp, user attribution, and optional metadata.
- **FR-006**: System MUST ensure that step completion operations are idempotent; marking an already completed step MUST succeed without error or data corruption.
- **FR-007**: System MUST automatically mark copied configuration steps (`GRADE`, `JOB_TITLE`, etc.) as `COMPLETED` during template copy-on-create provisioning.
- **FR-008**: System MUST consume asynchronous message bus events for external domains:
  - `authorization.role-copy.completed` / `authorization.role-setup.completed` to mark Step 6 (`ROLE`) as `COMPLETED`.
  - `employee-import.batch.completed` to mark Step 7 (`EMPLOYEE_IMPORT`) as `COMPLETED`.
- **FR-009**: System MUST store external reference identifiers (e.g., `roleBatchId`, `importBatchId`) and optional payload metadata for externally completed steps.
- **FR-010**: System MUST NOT store, validate, or duplicate external domain master records (roles, permissions, employee personal data) within the Setting Service database.
- **FR-011**: System MUST deduplicate incoming external completion events using an idempotency key with a 24-hour retention window.
- **FR-012**: System MUST route unprocessable or malformed external completion events to a dead-letter topic (DLT).
- **FR-013**: System MUST provide a synchronous query service and REST API endpoint (`GET /companies/:id/setup`) returning the complete setup progress breakdown and readiness calculation.
- **FR-014**: System MUST evaluate `isEligibleForActivation` as `true` if and only if all 8 steps have status `COMPLETED`.
- **FR-015**: System MUST list all `incompleteSteps` in the progress response when `completedSteps < 8`.
- **FR-016**: Progress queries MUST be served entirely from local PostgreSQL reads against `company_setup_steps` without making synchronous HTTP calls to external microservices.
- **FR-017**: The progress REST API endpoint MUST enforce Role-Based Access Control allowing only authenticated Administrators and HR Business Users.

### Key Entities *(include if feature involves data)*

- **Company Setup Step (`company_setup_steps`)**: Represents an individual mandatory onboarding milestone for a specific Company. Attributes:
  - `id`: Unique identifier (UUID, Primary Key).
  - `tenant_id`: Scoped Tenant identifier (UUID, Indexed, NOT NULL).
  - `company_id`: Scoped Company identifier (UUID, Foreign Key to `companies`, Indexed, NOT NULL).
  - `step_type`: Enumeration of the 8 setup steps (`COMPANY_INFORMATION`, `LOCATION`, `DEPARTMENT`, `GRADE`, `JOB_TITLE`, `ROLE`, `EMPLOYEE_IMPORT`, `ORGANIZATION_RESPONSIBILITY`).
  - `step_order`: Integer sequence order (1 through 8, NOT NULL).
  - `status`: Completion status enumeration (`INCOMPLETE`, `COMPLETED`, DEFAULT `'INCOMPLETE'`).
  - `completed_at`: Timestamp when the step was marked completed (nullable).
  - `completed_by`: Identifier of the user who completed the step (nullable UUID).
  - `external_reference_id`: Reference identifier from external domain events (nullable string).
  - `metadata`: Flexible contextual JSON attributes such as `{ "completedViaCopy": true }` or batch metrics (nullable JSONB).
  - `created_at`, `updated_at`: Audit timestamps.
- **Company (`companies`)**: The parent entity representing an organizational legal entity in `PENDING` or `ACTIVE` status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly created companies have all 8 mandatory setup steps initialized in `INCOMPLETE` status upon creation.
- **SC-002**: 100% of setup progress queries (`GET /companies/:id/setup`) return within 100ms via local database reads without external network dependencies.
- **SC-003**: 100% of step completion events from internal Setting modules execute within the calling module's transaction with zero inconsistent states.
- **SC-004**: 100% of external completion events from Authorization and Employee Import domains are processed and reflected in setup progress within 5 seconds of event publication.
- **SC-005**: 100% of duplicate Kafka events are safely ignored via Redis deduplication without redundant database updates.
- **SC-006**: Company activation eligibility (`isEligibleForActivation`) strictly returns `true` if and only if all 8 steps are `COMPLETED`, with zero false positives.
- **SC-007**: 100% of cross-tenant progress queries are rejected with HTTP 404/403, guaranteeing complete tenant isolation.

## Assumptions

- Step completion criteria for internal modules are triggered upon the first successful creation or template-copy of relevant entities (e.g., at least one Location for Step 2, at least one Department for Step 3, at least one Grade for Step 4, at least one Job Title for Step 5, and at least one PoC for Step 8).
- External services (Authorization Service and Employee Import Service) are responsible for publishing standardized completion events over Kafka upon successful batch role assignment or employee import.
- Setting Service does not validate internal data contents of external domains, relying on signed/authenticated event envelopes and external reference IDs.
- Standard tenant isolation and user authentication are supplied via platform gateway headers and `RequestContext`.

