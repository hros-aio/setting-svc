# Feature Specification: Department Management

**Feature Branch**: `009-department-management`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "Backend Task Breakdown: Department Management - Enable Administrators to define, update, and deactivate functional business units (Departments) scoped strictly to a single Company with mandatory future effective dating (>= end of current business day), preserving active and historical integrity without hard deletes, enforcing hierarchy integrity (parent validation, anti-cycle checks), and tracking setup step completion."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Schedule a Department (Priority: P1)

As a Company Administrator, I want to create a new department for my company with a mandatory future effective date and an optional same-company parent department, so that the organizational structure is established and company onboarding setup step 3 (Department) is satisfied.

**Why this priority**: Core foundational capability needed to establish functional organizational units and satisfy the Department setup step during company onboarding.

**Independent Test**: Can be tested independently by submitting a valid department creation request with a future effective date and verifying the record is scheduled, visible in the system, and advances company setup readiness.

**Acceptance Scenarios**:

1. **Given** an Administrator scoped to a Company, **When** they create a new department with a code, name, optional same-company parent department, and an effective date scheduled at or after the end of the current business day in the company's timezone, **Then** the department is stored in `scheduled` status with the target effective date.
2. **Given** a Company undergoing initial setup with incomplete steps, **When** the first department is created and scheduled, **Then** the `DEPARTMENT` setup step (Step 3) for that Company is marked as completed.
3. **Given** a creation request with an effective date earlier than the end of the current business day in the Company's timezone, **When** submitted, **Then** the system rejects the request with a validation error indicating future effective dating rules.
4. **Given** a creation request referencing a parent department that belongs to another Company or is in `inactive` status, **When** submitted, **Then** the system rejects the request with a validation error.
5. **Given** a creation request specifying a department code that already exists within the same Company, **When** submitted, **Then** the system rejects the request with a duplicate code conflict error.

---

### User Story 2 - Query Active and Historical Departments with Multi-Company Isolation (Priority: P1)

As an HR Business User or Administrator, I want to view the list of currently active departments (in flat list or hierarchical tree format) as well as inspect specific historical or inactive departments within my assigned Company, so that organizational structures can be navigated accurately without cross-company data leakage.

**Why this priority**: Essential operational read capability required by downstream modules, employee assignments, organizational charts, and administrative visibility.

**Independent Test**: Can be tested independently by querying active department lists and direct department details using authorized credentials across multiple distinct companies.

**Acceptance Scenarios**:

1. **Given** an authenticated user scoped to Company A, **When** they request the list of active departments, **Then** only departments belonging to Company A with `active` status are returned (excluding `scheduled` and `inactive` departments).
2. **Given** an inactive or historical department in Company A, **When** an Administrator queries that specific department by ID within Company A, **Then** the full details and historical status are returned for audit reference.
3. **Given** a user scoped to Company A, **When** they attempt to list or access departments belonging to Company B, **Then** the system denies access or returns a not-found response ensuring strict tenant and company isolation.

---

### User Story 3 - Update Department with Hierarchy Loop Protection (Priority: P2)

As a Company Administrator, I want to update an existing active department (such as name, code, or parent department) with a future effective date while preventing circular reporting structures, so that planned organizational adjustments are scheduled safely without corrupting the department tree.

**Why this priority**: Allows ongoing operational maintenance of organizational units while orchestrating future state changes and safeguarding hierarchy graph integrity.

**Independent Test**: Can be tested independently by updating an active department with valid modifications and attempting circular hierarchy updates (e.g., A -> B -> A) to verify cycle detection.

**Acceptance Scenarios**:

1. **Given** an active department with no pending changes, **When** an Administrator updates department fields with a valid future effective date ($\ge$ end of current business day), **Then** a pending scheduled change is created to hold modifications until the effective date while the active department master record remains unmodified.
2. **Given** an active Department A and Department B where B is a descendant of A, **When** an Administrator attempts to update Department A's parent to Department B, **Then** the system detects the circular dependency through ancestor traversal and rejects the request.
3. **Given** an active department that already has a pending scheduled change, **When** an Administrator attempts to submit another update or deactivation, **Then** the system rejects the request with a conflict error enforcing the single-pending-change constraint.

---

### User Story 4 - Schedule Department Deactivation (Priority: P2)

As a Company Administrator, I want to schedule the deactivation of an active department for a future effective date, so that the department remains fully operational until that date and transitions to inactive automatically without hard deletes.

**Why this priority**: Required for retiring functional units or restructuring without breaking historical employee assignments or audit trails.

**Independent Test**: Can be tested independently by scheduling deactivation on an active department, verifying it remains active prior to the effective date, and confirming it transitions to inactive upon effective date arrival.

**Acceptance Scenarios**:

1. **Given** an active department with no pending changes, **When** an Administrator schedules deactivation with a valid future effective date, **Then** a pending deactivation change is recorded and the department remains in `active` status until the effective date.
2. **Given** an active department that already has a pending scheduled change, **When** an Administrator attempts to schedule deactivation, **Then** the system rejects the request enforcing the single-pending-change constraint.
3. **Given** a department that is already in `inactive` status, **When** an Administrator attempts to update or deactivate it, **Then** the system rejects the request with a validation error indicating that inactive departments cannot be modified.

---

### User Story 5 - Automatic Effective Execution and State Transition (Priority: P3)

As the HRMS System, I want scheduled department creations, updates, and deactivations to execute automatically when their effective date and time arrive, so that organizational master data reflects the planned reality seamlessly and notifies downstream domains.

**Why this priority**: Completes the lifecycle of scheduled changes and synchronizes master data across the enterprise platform.

**Independent Test**: Can be tested independently by triggering the execution consumer for scheduled changes and verifying status transitions and domain event publication.

**Acceptance Scenarios**:

1. **Given** a department in `scheduled` status reaching its effective time, **When** the execution trigger is processed, **Then** its status transitions to `active` and a domain creation notification is emitted.
2. **Given** a scheduled `UPDATE` pending change reaching its effective time with valid precondition state, **When** the execution trigger is processed, **Then** the modified fields are applied to the active department, the change is marked as `applied`, and a domain update notification is emitted.
3. **Given** a scheduled `DEACTIVATE` pending change reaching its effective time, **When** the execution trigger is processed, **Then** the department status transitions to `inactive`, the change is marked as `applied`, and a domain deactivation notification is emitted.
4. **Given** a duplicate delivery of an execution trigger, **When** processed, **Then** the system detects the duplicated trigger, skips re-execution, and completes safely without redundant side effects.

---

### Edge Cases

- What happens when a user attempts to set a department's parent to the department itself? The system rejects the request immediately via self-parent validation checks.
- What happens when an update creates a multi-node circular hierarchy (e.g., A -> B -> C -> A)? The system traverses the ancestor hierarchy (up to a maximum depth of 50) and rejects the update with a circular hierarchy error.
- What happens when an update assigns a parent department that belongs to another company in the same tenant? The system rejects the assignment because parent departments must belong to the same company.
- What happens when a parent department is deactivated before a scheduled child department creation or update becomes effective? The execution handler detects the inconsistency upon execution and marks the pending change as a conflict without corrupting master data.
- What happens when an administrator tries to reuse the code of an inactive department? The system rejects the creation or update due to the unique department code constraint scoped to the company.
- What happens when a creation or update request specifies an effective date in the past or earlier than the end of the current business day? The system rejects the request with an effective date validation error based on the company's timezone.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enforce multi-tenant and multi-company isolation on all department operations and queries.
- **FR-002**: System MUST require a future effective date ($\ge$ end of current business day in the company's timezone, falling back to UTC if unconfigured) for all department creation, update, and deactivation requests.
- **FR-003**: System MUST store newly created departments in `scheduled` status until their effective date arrives.
- **FR-004**: System MUST mark Company Setup Step 3 (`DEPARTMENT`) as completed upon the first scheduled or active department in a Company.
- **FR-005**: System MUST validate that any assigned parent department exists, is in `active` status, belongs to the same Company, and is not the department itself.
- **FR-006**: System MUST prevent circular parent-child relationships in the department hierarchy by performing ancestor chain cycle detection (up to maximum depth 50).
- **FR-007**: System MUST enforce uniqueness of department `code` within the scope of a single Company.
- **FR-008**: System MUST enforce that at most one pending scheduled change can exist for a given department at any time.
- **FR-009**: System MUST record update modifications in a pending change entity, leaving the active department master record unmodified until the effective date.
- **FR-010**: System MUST record deactivation requests in a pending change entity, keeping the department in `active` status until the effective date.
- **FR-011**: System MUST support querying active departments (in flat list and hierarchical tree views) while excluding scheduled and inactive records from default active queries.
- **FR-012**: System MUST support querying full details of specific historical or inactive departments by ID within company scope.
- **FR-013**: System MUST execute state transitions automatically upon receiving scheduled execution triggers: transitioning `scheduled` to `active`, applying pending updates, or transitioning `active` to `inactive`.
- **FR-014**: System MUST handle execution triggers idempotently to prevent duplicate state mutations or redundant event emissions.
- **FR-015**: System MUST emit domain master data events to downstream services upon successful execution of department creations, updates, and deactivations.
- **FR-016**: System MUST preserve historical department versions and state transitions without performing hard physical deletes.

### Key Entities *(include if feature involves data)*

- **Department**: Represents a functional business or organizational unit within a company. Attributes include unique identifier, tenant identifier, company identifier, department code, name, parent department identifier (optional hierarchy link), operational status (`scheduled`, `active`, `inactive`), effective timestamp, and audit timestamps.
- **Effective Change**: Represents a scheduled state modification (update or deactivation) awaiting execution on its effective date. Attributes include unique identifier, entity type (`DEPARTMENT`), entity identifier, tenant identifier, company identifier, change type (`UPDATE` or `DEACTIVATE`), change payload data, operational status (`scheduled`, `applied`, `failed`, `conflict`), target effective timestamp, expected version timestamp for optimistic concurrency validation, and audit timestamps.
- **Company Setup Step**: Represents the onboarding readiness checklist item for a company. Attributes include tenant identifier, company identifier, step identifier (`DEPARTMENT`), completion status, and completion timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of department read and write operations are strictly scoped to the caller's authorized company, with zero cross-company data exposure.
- **SC-002**: 100% of invalid hierarchy configurations (self-parenting, cross-company parents, and circular loops up to depth 50) are detected and rejected at request time.
- **SC-003**: 100% of scheduled department state transitions (creations, updates, deactivations) execute automatically and idempotently within 60 seconds of their effective timestamp.
- **SC-004**: 100% of department modifications maintain historical auditability with zero hard deletes.
- **SC-005**: First department creation/scheduling reliably advances company onboarding Setup Step 3 (`DEPARTMENT`) to completed status in 100% of eligible onboarding flows.
- **SC-006**: Administrators can successfully configure and schedule a new department in under 2 minutes.

## Assumptions

- Timezone calculations for "end of current business day" are determined based on the parent Company's configured timezone attribute, falling back to UTC if not specified.
- Deactivated departments remain permanently preserved for audit, reporting, and historical employee records; department codes from deactivated departments cannot be reused within the same company.
- Maximum traversal depth for cycle detection in the department hierarchy tree is set to 50 levels, which exceeds standard organizational depth requirements.
- Standard authentication and tenant context resolution are provided by platform gateway guards prior to controller execution.
