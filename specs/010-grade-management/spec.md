# Feature Specification: Grade Management

**Feature Branch**: `010-grade-management`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "Backend Task Breakdown: Grade Management - Enable authenticated Administrators to configure, update, and deactivate compensation and leveling Grades scoped strictly to a single Company with mandatory future effective dating (>= end of current business day), staging operations in a scheduled state, preserving historical state without hard deletion, enforcing single pending change constraints, and satisfying Company Setup Step 4 (GRADE)."

## Clarifications

### Session 2026-08-16
- Q: What is the canonical REST API endpoint routing structure for Grade management? → A: Standard `/grades` root endpoints (`POST /grades`, `GET /grades`, `GET /grades/:id`, `PATCH /grades/:id`, `POST /grades/:id/deactivate`) with tenant and company context resolved from `RequestContextService` / JWT headers (removing redundant `/companies/:companyId/grades` routes).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Schedule a Grade (Priority: P1)

As a Company Administrator, I want to create and schedule a compensation/leveling Grade for my company with a mandatory future effective date, so that compensation structures and leveling bands are established and company onboarding setup step 4 (Grade) is satisfied.

**Why this priority**: Core foundational master data capability required to define job leveling, compensation tiers, and satisfy Step 4 of company onboarding setup.

**Independent Test**: Can be tested independently by submitting a valid Grade creation request with a future effective date and verifying the record is stored in `scheduled` status, company-scoped, and marks Step 4 (`GRADE`) as completed.

**Acceptance Scenarios**:

1. **Given** an Administrator scoped to a Company, **When** they create a new Grade with a unique code, name, optional rank, and an effective date on or after the end of the current business day in the company's timezone, **Then** the Grade is saved with `scheduled` status and the target effective date.
2. **Given** a Company undergoing initial onboarding setup where Step 4 is incomplete, **When** the first Grade is created and scheduled, **Then** Company Setup Step 4 (`GRADE`) is marked as `COMPLETED`.
3. **Given** a Grade creation request with an effective date earlier than the end of the current business day in the company's timezone, **When** submitted, **Then** the system rejects the request with a validation error detailing future effective dating requirements.
4. **Given** a Grade creation request with a code that already exists within the same Company (regardless of active, scheduled, or inactive status), **When** submitted, **Then** the system rejects the request with a duplicate code conflict error.
5. **Given** Grade code "L3" exists in Company A, **When** an Administrator creates Grade code "L3" in Company B within the same Tenant, **Then** the creation succeeds without conflict, verifying company-level code scoping.

---

### User Story 2 - Query Active, Scheduled, and Historical Grades (Priority: P1)

As an HR Business User or Administrator, I want to query the current active Grades for operational use or inspect scheduled and historical Grade configurations for administrative planning and audits, ensuring strict multi-company isolation.

**Why this priority**: Fundamental operational read capability required by employee assignment workflows, compensation structures, and administrative governance without cross-company data leakage.

**Independent Test**: Can be tested independently by querying active Grade endpoints and administrative inspection endpoints across multiple distinct companies with different data states.

**Acceptance Scenarios**:

1. **Given** an authenticated user scoped to Company A, **When** they request active Grades, **Then** only Grades belonging to Company A with `active` status are returned (excluding `scheduled` and `inactive` records).
2. **Given** an active Grade with a pending future update scheduled, **When** an Administrator queries that Grade's details, **Then** the response includes the current active values along with the scheduled pending change details (effective date, pending changes).
3. **Given** an inactive or historical Grade in Company A, **When** an Administrator queries that Grade by ID within Company A, **Then** the system returns full historical details and status for audit reference.
4. **Given** a user scoped to Company A, **When** they attempt to list or retrieve Grade records belonging to Company B, **Then** the system denies access, ensuring strict company isolation.

---

### User Story 3 - Schedule Grade Updates (Priority: P2)

As a Company Administrator, I want to update an existing active Grade's attributes (such as name or rank) with a future effective date while enforcing single-pending-change constraints, so that compensation band adjustments are scheduled safely without disrupting current active operations.

**Why this priority**: Necessary for ongoing compensation band and leveling governance while ensuring changes take effect predictably at a designated future time.

**Independent Test**: Can be tested independently by scheduling an update on an active Grade, verifying that the active Grade values remain intact prior to the effective date, and confirming that concurrent/subsequent pending change attempts are rejected.

**Acceptance Scenarios**:

1. **Given** an active Grade with no pending scheduled changes, **When** an Administrator updates Grade attributes (name, rank) with a valid future effective date ($\ge$ end of current business day), **Then** the modification is stored as a pending scheduled change, and the active Grade record remains unmodified until the effective date.
2. **Given** an active Grade that already has a pending scheduled change (update or deactivation), **When** an Administrator attempts to submit another update or deactivation for the same Grade, **Then** the system rejects the request with a conflict error enforcing the single-pending-change rule.
3. **Given** a Grade in `scheduled` or `inactive` status, **When** an Administrator attempts to schedule an update, **Then** the system rejects the request with an invalid state error.

---

### User Story 4 - Schedule Grade Deactivation (Priority: P2)

As a Company Administrator, I want to schedule the deactivation of an active Grade for a future effective date, so that the Grade remains available until the planned retirement date and transitions to inactive without hard deletion.

**Why this priority**: Required for retiring obsolete compensation levels or leveling bands while preserving historical audit trails and historical employee assignments.

**Independent Test**: Can be tested independently by scheduling deactivation on an active Grade, verifying that it remains active until the effective date arrives, and confirming that it transitions to inactive upon effective date arrival.

**Acceptance Scenarios**:

1. **Given** an active Grade with no pending changes, **When** an Administrator schedules deactivation with a valid future effective date, **Then** a pending deactivation change is recorded and the Grade master record remains in `active` status until the effective date.
2. **Given** an active Grade that already has a pending scheduled change, **When** an Administrator attempts to schedule deactivation, **Then** the system rejects the request enforcing the single-pending-change rule.
3. **Given** a Grade that is already in `inactive` status, **When** an Administrator attempts to deactivate or modify it, **Then** the system rejects the request indicating that inactive Grades cannot be modified.

---

### User Story 5 - Automatic Effective Execution and Domain Synchronization (Priority: P3)

As the HRMS System, I want scheduled Grade creations, updates, and deactivations to execute automatically when their effective date and time arrive, so that active compensation master data reflects scheduled changes seamlessly and notifies downstream domain consumers.

**Why this priority**: Closes the effective-dating lifecycle loop by executing scheduled state changes automatically and broadcasting authoritative domain events.

**Independent Test**: Can be tested independently by triggering the execution consumer for scheduled creations, updates, and deactivations and verifying status transitions and domain event emissions.

**Acceptance Scenarios**:

1. **Given** a Grade in `scheduled` status reaching its effective time, **When** the execution trigger is processed, **Then** the Grade status transitions from `scheduled` to `active` and a Grade created domain notification is published.
2. **Given** a scheduled `UPDATE` change reaching its effective time with valid version state, **When** the execution trigger is processed, **Then** the pending modifications are applied to the active Grade, the change record is marked as `applied`, and a Grade updated domain notification is published.
3. **Given** a scheduled `DEACTIVATE` change reaching its effective time, **When** the execution trigger is processed, **Then** the Grade status transitions from `active` to `inactive`, the change record is marked as `applied`, and a Grade deactivated domain notification is published.
4. **Given** a duplicate delivery of an execution trigger, **When** processed, **Then** the system detects the duplicate, skips re-execution, and completes without duplicate side effects or redundant event publishing.

---

### Edge Cases

- What happens when a user submits an effective date in the past or earlier than the end of the current business day? The system rejects the request with a validation error based on the company's timezone (or UTC default).
- What happens when an administrator tries to reuse a Grade code from an inactive Grade in the same company? The system rejects the creation or code update because Grade codes must remain unique within a company across all statuses.
- What happens when an active Grade has a pending update scheduled, and an administrator tries to submit a deactivation? The system rejects the deactivation with a single-pending-change conflict error until the existing pending change is either applied or cancelled.
- What happens when a master Grade record is updated or modified between when a change was scheduled and when the effective time arrives? The execution handler verifies the expected version/timestamp; if state drift is detected, the change is marked as `conflict`, an alert is recorded, and the master row is left unmodified.
- What happens when a new company is provisioned from a template? Template Grades are copied snapshot-style on creation with a reference to the source template Grade (`source_grade_id`) for lineage tracing only, with zero ongoing inheritance or coupling.
- What happens to employees currently assigned to a Grade when the Grade is updated or deactivated? Grade master data state changes are published as domain events; downstream employee domain services consume these events asynchronously according to their organizational policies.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enforce multi-tenant and multi-company isolation across all Grade operations, listings, and details queries.
- **FR-002**: System MUST require a mandatory future effective date ($\ge$ end of current business day in the company's timezone, falling back to UTC if unconfigured) for all Grade creation, update, and deactivation requests.
- **FR-003**: System MUST store newly created Grades in `scheduled` status until their effective date arrives.
- **FR-004**: System MUST mark Company Setup Step 4 (`GRADE`) as completed upon the first scheduled or active Grade created for a Company.
- **FR-005**: System MUST enforce uniqueness of Grade `code` within the scope of a single Company across all statuses (`scheduled`, `active`, `inactive`).
- **FR-006**: System MUST enforce that at most one pending scheduled change can exist for any Grade entity at any given time.
- **FR-007**: System MUST record update modifications in a pending change record, keeping the active Grade master record unmodified until the effective date arrives.
- **FR-008**: System MUST record deactivation requests in a pending change record, maintaining the Grade in `active` status until the effective date arrives.
- **FR-009**: System MUST support querying active Grades while excluding scheduled and inactive records from default operational queries.
- **FR-010**: System MUST support administrative queries for all Grades (including scheduled, active, and inactive) and composite queries that include active attributes alongside pending scheduled changes.
- **FR-011**: System MUST execute state transitions automatically upon receiving scheduled execution triggers: transitioning `scheduled` to `active`, applying pending updates, or transitioning `active` to `inactive`.
- **FR-012**: System MUST verify expected version state before applying scheduled changes to detect state drift and prevent inconsistent updates.
- **FR-013**: System MUST handle execution triggers idempotently to prevent duplicate state mutations or redundant event emissions.
- **FR-014**: System MUST emit domain master data events to downstream services upon successful execution of Grade creations, updates, and deactivations.
- **FR-015**: System MUST preserve historical Grade versions and state transitions without performing hard physical deletes.
- **FR-016**: System MUST maintain optional source Grade lineage (`source_grade_id`) when Grades are initialized from configuration templates during company provisioning.

### Key Entities *(include if feature involves data)*

- **Grade**: Represents a compensation level, grading band, or job grade within a company. Attributes include unique identifier, tenant identifier, company identifier, grade code, grade name, rank/level ordering (optional), operational status (`scheduled`, `active`, `inactive`), effective timestamp, source template grade reference (optional lineage), and audit timestamps.
- **Effective Change**: Represents a scheduled state modification (update or deactivation) awaiting execution on its effective date. Attributes include unique identifier, entity type (`GRADE`), entity identifier, tenant identifier, company identifier, change action (`UPDATE` or `DEACTIVATE`), change payload data, operational status (`scheduled`, `applied`, `failed`, `conflict`), target effective timestamp, expected version timestamp for optimistic concurrency validation, and audit timestamps.
- **Company Setup Step**: Represents the onboarding readiness checklist item for a company. Attributes include tenant identifier, company identifier, step identifier (`GRADE`), completion status, and completion timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Grade read and write operations are strictly scoped to the caller's authorized company, with zero cross-company data exposure.
- **SC-002**: 100% of Grade creation, update, and deactivation attempts with past or same-day effective dates are rejected at request validation time.
- **SC-003**: 100% of scheduled Grade state transitions (creations, updates, deactivations) execute automatically and idempotently within 60 seconds of their scheduled effective timestamp.
- **SC-004**: 100% of Grade modifications maintain complete historical auditability with zero hard deletions.
- **SC-005**: First Grade creation/scheduling reliably advances company onboarding Setup Step 4 (`GRADE`) to completed status in 100% of eligible onboarding flows.
- **SC-006**: 100% of duplicate execution triggers are deduplicated safely without redundant state mutations or duplicate domain event emissions.
- **SC-007**: Administrators can configure and schedule a new Grade in under 2 minutes.

## Assumptions

- Timezone calculations for "end of current business day" are determined based on the parent Company's configured timezone attribute, falling back to UTC if unconfigured.
- Deactivated Grades remain permanently preserved for audit, reporting, and historical employee compensation records; Grade codes from deactivated records cannot be reused within the same company.
- Downstream domains (such as Directory and Payroll) consume Grade master data domain events asynchronously to update employee-level assignments according to domain-specific business rules.
- Standard authentication and tenant context resolution are provided by platform gateway guards prior to service execution.
