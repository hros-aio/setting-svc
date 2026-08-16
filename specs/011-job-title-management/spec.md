# Feature Specification: Job Title Management

**Feature Branch**: `011-job-title-management`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "Job Title Management - Allow authenticated Administrators to define, update, and deactivate Job Titles scoped strictly to a single Company. Each Job Title is structurally tied to a functional Department and Grade within that same Company. All create, update, and deactivate operations require a mandatory future Effective Date (>= end of current business day), staging changes in a scheduled status (as scheduled master rows or effective_changes records) and transitioning active states automatically at the effective time via the Go Worker scheduling coordination loop. The first created Job Title automatically signals completion of Mandatory Setup Step 5 (JOB_TITLE)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Schedule a Job Title (Priority: P1)

As a Company Administrator, I want to define and schedule a new Job Title tied to an active Department and Grade within my company with a mandatory future effective date, so that job positions are established with proper organizational hierarchy and company onboarding setup step 5 (Job Title) is satisfied.

**Why this priority**: Foundational master data capability required to define job structures, associate job titles with functional departments and leveling grades, and complete mandatory onboarding setup Step 5.

**Independent Test**: Can be tested independently by submitting a valid Job Title creation request with valid same-company Department and Grade associations and a future effective date, verifying that the record is stored in `scheduled` status, company-scoped, and marks Step 5 (`JOB_TITLE`) as completed.

**Acceptance Scenarios**:

1. **Given** an Administrator scoped to a Company with existing active Department and Grade, **When** they create a new Job Title with a unique code, name, department ID, grade ID, and an effective date on or after the end of the current business day in the company's timezone, **Then** the Job Title is saved with `scheduled` status and the target effective date.
2. **Given** a Company undergoing initial onboarding setup where Step 5 is incomplete, **When** the first Job Title is created and scheduled, **Then** Company Setup Step 5 (`JOB_TITLE`) is marked as `COMPLETED`.
3. **Given** a Job Title creation request referencing a `departmentId` or `gradeId` belonging to a different Company, **When** submitted, **Then** the system rejects the request with a validation error enforcing strict same-company cross-entity integrity.
4. **Given** a Job Title creation request referencing a Department or Grade that is `inactive`, **When** submitted, **Then** the system rejects the request with an invalid entity state error.
5. **Given** a Job Title creation request with an effective date earlier than the end of the current business day in the company's timezone, **When** submitted, **Then** the system rejects the request with a validation error detailing future effective dating requirements.
6. **Given** a Job Title creation request with a code that already exists within the same Company (across active, scheduled, or inactive statuses), **When** submitted, **Then** the system rejects the request with a duplicate code conflict error.
7. **Given** Job Title code "ENG-01" exists in Company A, **When** an Administrator creates Job Title code "ENG-01" in Company B within the same Tenant, **Then** the creation succeeds, confirming multi-company code isolation.

---

### User Story 2 - Query Active, Scheduled, and Historical Job Titles (Priority: P1)

As an HR Business User or Administrator, I want to query active Job Titles for operational employee assignments or inspect scheduled and historical Job Title configurations for administrative planning and audits, ensuring strict multi-company isolation.

**Why this priority**: Fundamental operational read capability required by employee positioning, recruitment workflows, and administrative governance without cross-company data leakage.

**Independent Test**: Can be tested independently by querying active Job Title endpoints and administrative inspection endpoints across multiple distinct companies with different data states.

**Acceptance Scenarios**:

1. **Given** an authenticated user scoped to Company A, **When** they request active Job Titles, **Then** only Job Titles belonging to Company A with `active` status are returned (excluding `scheduled` and `inactive` records).
2. **Given** an active Job Title with a pending future update scheduled, **When** an Administrator queries that Job Title's details, **Then** the response includes the current active values along with the scheduled pending change details (effective date, pending changes).
3. **Given** an inactive or historical Job Title in Company A, **When** an Administrator queries that Job Title by ID within Company A, **Then** the system returns full historical details and status for audit reference.
4. **Given** a user scoped to Company A, **When** they attempt to list or retrieve Job Title records belonging to Company B, **Then** the system denies access, ensuring strict company isolation.

---

### User Story 3 - Schedule Job Title Updates (Priority: P2)

As a Company Administrator, I want to update an existing active Job Title's attributes (such as name, department assignment, or grade assignment) with a future effective date while enforcing single-pending-change constraints and cross-company validation, so that organizational reassignments are scheduled safely without disrupting active operations.

**Why this priority**: Necessary for ongoing organizational changes, department restructuring, and grade realignment while ensuring changes take effect predictably at a designated future time.

**Independent Test**: Can be tested independently by scheduling an update on an active Job Title, verifying that the active Job Title values remain intact prior to the effective date, confirming cross-company validation for new department/grade references, and confirming that concurrent/subsequent pending change attempts are rejected.

**Acceptance Scenarios**:

1. **Given** an active Job Title with no pending scheduled changes, **When** an Administrator updates attributes (name, department, grade) with a valid future effective date ($\ge$ end of current business day) and valid same-company active references, **Then** the modification is stored as a pending scheduled change, and the active Job Title record remains unmodified until the effective date.
2. **Given** an update request attempting to reassign the Job Title to a Department or Grade belonging to another Company or in `inactive` status, **When** submitted, **Then** the system rejects the request with a validation error.
3. **Given** an active Job Title that already has a pending scheduled change (update or deactivation), **When** an Administrator attempts to submit another update or deactivation for the same Job Title, **Then** the system rejects the request with a conflict error enforcing the single-pending-change rule.
4. **Given** a Job Title in `scheduled` or `inactive` status, **When** an Administrator attempts to schedule an update, **Then** the system rejects the request with an invalid state error.

---

### User Story 4 - Schedule Job Title Deactivation (Priority: P2)

As a Company Administrator, I want to schedule the deactivation of an active Job Title for a future effective date, so that the Job Title remains available until the planned retirement date and transitions to inactive without hard deletion.

**Why this priority**: Required for retiring obsolete job roles while preserving historical audit trails and historical employee assignments.

**Independent Test**: Can be tested independently by scheduling deactivation on an active Job Title, verifying that it remains active until the effective date arrives, and confirming that it transitions to inactive upon effective date arrival.

**Acceptance Scenarios**:

1. **Given** an active Job Title with no pending changes, **When** an Administrator schedules deactivation with a valid future effective date, **Then** a pending deactivation change is recorded and the Job Title master record remains in `active` status until the effective date.
2. **Given** an active Job Title that already has a pending scheduled change, **When** an Administrator attempts to schedule deactivation, **Then** the system rejects the request enforcing the single-pending-change rule.
3. **Given** a Job Title that is already in `inactive` status, **When** an Administrator attempts to deactivate or modify it, **Then** the system rejects the request indicating that inactive Job Titles cannot be modified.

---

### User Story 5 - Automatic Effective Execution and Domain Synchronization (Priority: P3)

As the HRMS System, I want scheduled Job Title creations, updates, and deactivations to execute automatically when their effective date and time arrive, so that active job master data reflects scheduled changes seamlessly and notifies downstream domain consumers.

**Why this priority**: Closes the effective-dating lifecycle loop by executing scheduled state changes automatically and broadcasting authoritative domain events.

**Independent Test**: Can be tested independently by triggering the execution consumer for scheduled creations, updates, and deactivations and verifying status transitions and domain event emissions.

**Acceptance Scenarios**:

1. **Given** a Job Title in `scheduled` status reaching its effective time, **When** the execution trigger is processed, **Then** the Job Title status transitions from `scheduled` to `active` and a Job Title created domain notification is published.
2. **Given** a scheduled `UPDATE` change reaching its effective time with valid version state, **When** the execution trigger is processed, **Then** the pending modifications are applied to the active Job Title, the change record is marked as `applied`, and a Job Title updated domain notification is published.
3. **Given** a scheduled `DEACTIVATE` change reaching its effective time, **When** the execution trigger is processed, **Then** the Job Title status transitions from `active` to `inactive`, the change record is marked as `applied`, and a Job Title deactivated domain notification is published.
4. **Given** an update execution where the master record's version/timestamp has drifted from `expected_updated_at`, **When** processed, **Then** the change record transitions to `conflict` and master fields are left unmodified.
5. **Given** a duplicate delivery of an execution trigger, **When** processed, **Then** the system detects the duplicate, skips re-execution, and completes without duplicate side effects or redundant event publishing.

---

### Edge Cases

- What happens when a user submits an effective date in the past or earlier than the end of the current business day? The system rejects the request with a validation error based on the company's timezone (or UTC default).
- What happens when an administrator tries to reuse a Job Title code from an inactive Job Title in the same company? The system rejects the creation or code update because Job Title codes must remain unique within a company across all statuses.
- What happens when an administrator attempts to associate a Job Title with a Department or Grade from another Company? The system strictly validates company ownership and rejects the request with a validation error.
- What happens if the referenced Department or Grade is deactivated before the scheduled Job Title's effective date arrives? The execution handler verifies optimistic state; if an inconsistency or invalid state is detected, the change transitions to `conflict` without breaking database integrity.
- What happens when an active Job Title has a pending update scheduled, and an administrator tries to submit a deactivation? The system rejects the deactivation with a single-pending-change conflict error until the existing pending change is either applied or cancelled.
- What happens when a new company is provisioned from a template? Template Job Titles are copied snapshot-style on creation with a reference to the source template Job Title (`source_job_title_id`) for lineage tracing only, with zero ongoing inheritance or coupling. Target-company department and grade references are mapped during template copy.
- What happens to employees currently assigned to a Job Title when the Job Title is updated or deactivated? Job Title master data state changes are published as domain events; downstream employee domain services consume these events asynchronously according to their organizational policies.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enforce multi-tenant and multi-company isolation across all Job Title operations, listings, and detail queries.
- **FR-002**: System MUST require a mandatory future effective date ($\ge$ end of current business day in the company's timezone, falling back to UTC if unconfigured) for all Job Title creation, update, and deactivation requests.
- **FR-003**: System MUST require every Job Title to be associated with a valid, active Department belonging to the exact same Company and Tenant.
- **FR-004**: System MUST require every Job Title to be associated with a valid, active Grade belonging to the exact same Company and Tenant.
- **FR-005**: System MUST store newly created Job Titles in `scheduled` status until their effective date arrives.
- **FR-006**: System MUST mark Company Setup Step 5 (`JOB_TITLE`) as completed upon the first scheduled or active Job Title created for a Company.
- **FR-007**: System MUST enforce uniqueness of Job Title `code` within the scope of a single Company across all statuses (`scheduled`, `active`, `inactive`).
- **FR-008**: System MUST enforce that at most one pending scheduled change can exist for any Job Title entity at any given time.
- **FR-009**: System MUST record update modifications in a pending change record, keeping the active Job Title master record unmodified until the effective date arrives.
- **FR-010**: System MUST record deactivation requests in a pending change record, maintaining the Job Title in `active` status until the effective date arrives.
- **FR-011**: System MUST support querying active Job Titles while excluding scheduled and inactive records from default operational queries.
- **FR-012**: System MUST support administrative queries for all Job Titles (including scheduled, active, and inactive) and composite queries that include active attributes alongside pending scheduled changes.
- **FR-013**: System MUST execute state transitions automatically upon receiving scheduled execution triggers: transitioning `scheduled` to `active`, applying pending updates, or transitioning `active` to `inactive`.
- **FR-014**: System MUST verify expected version state before applying scheduled changes to detect state drift and prevent inconsistent updates.
- **FR-015**: System MUST handle execution triggers idempotently to prevent duplicate state mutations or redundant event emissions.
- **FR-016**: System MUST emit domain master data events to downstream services upon successful execution of Job Title creations, updates, and deactivations.
- **FR-017**: System MUST preserve historical Job Title versions and state transitions without performing hard physical deletes.
- **FR-018**: System MUST maintain optional source Job Title lineage (`source_job_title_id`) when Job Titles are initialized from configuration templates during company provisioning.

### Key Entities *(include if feature involves data)*

- **Job Title**: Represents a position, functional job role, or job title within a company. Attributes include unique identifier, tenant identifier, company identifier, job title code, job title name, department identifier (mandatory relation), grade identifier (mandatory relation), operational status (`scheduled`, `active`, `inactive`), effective timestamp, source template job title reference (optional lineage), and audit timestamps.
- **Department**: Represents the functional department within the company that the Job Title belongs to. Must belong to the exact same tenant and company.
- **Grade**: Represents the compensation tier or leveling grade within the company that the Job Title belongs to. Must belong to the exact same tenant and company.
- **Effective Change**: Represents a scheduled state modification (update or deactivation) awaiting execution on its effective date. Attributes include unique identifier, entity type (`JOB_TITLE`), entity identifier, tenant identifier, company identifier, change action (`UPDATE` or `DEACTIVATE`), change payload data, operational status (`scheduled`, `applied`, `failed`, `conflict`), target effective timestamp, expected version timestamp for optimistic concurrency validation, and audit timestamps.
- **Company Setup Step**: Represents the onboarding readiness checklist item for a company. Attributes include tenant identifier, company identifier, step identifier (`JOB_TITLE`), completion status, and completion timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Job Title read and write operations are strictly scoped to the caller's authorized company, with zero cross-company data exposure.
- **SC-002**: 100% of Job Title creation and update requests referencing cross-company or inactive Departments or Grades are rejected with unambiguous validation errors.
- **SC-003**: 100% of Job Title creation, update, and deactivation attempts with past or same-day effective dates are rejected at request validation time.
- **SC-004**: 100% of scheduled Job Title state transitions (creations, updates, deactivations) execute automatically and idempotently within 60 seconds of their scheduled effective timestamp.
- **SC-005**: 100% of Job Title modifications maintain complete historical auditability with zero hard deletions.
- **SC-006**: First Job Title creation/scheduling reliably advances company onboarding Setup Step 5 (`JOB_TITLE`) to completed status in 100% of eligible onboarding flows.
- **SC-007**: 100% of duplicate execution triggers are deduplicated safely without redundant state mutations or duplicate domain event emissions.
- **SC-008**: Administrators can configure and schedule a new Job Title in under 2 minutes.

## Assumptions

- Timezone calculations for "end of current business day" are determined based on the parent Company's configured timezone attribute, falling back to UTC if unconfigured.
- Deactivated Job Titles remain permanently preserved for audit, reporting, and historical employee records; Job Title codes from deactivated records cannot be reused within the same company.
- A Job Title must always have a valid Department and Grade associated with it; deleting or deactivating a Department or Grade does not hard-delete existing Job Titles but may impact future operational assignments.
- Downstream domains (such as Directory, Payroll, and Org Chart) consume Job Title master data domain events asynchronously to update employee-level assignments according to domain-specific business rules.
- Standard authentication and tenant context resolution are provided by platform gateway guards prior to service execution.
