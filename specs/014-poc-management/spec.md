# Feature Specification: Organization Responsibility (Point of Contact) Management

**Feature Branch**: `014-poc-management`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Breaking Tasks: Organization Responsibility (Point of Contact) Management - Allow authenticated Administrators to designate and update individuals as Points of Contact (PoCs) for specific organizational responsibilities/functions (e.g., HR Head, Finance Head, Country Head, IT Head, Payroll Owner) scoped strictly to a single Company. Responsibilities are modeled as standalone assignments independent of structural records (Location, Department, Grade, Job Title). Future-dated assignments/replacements are governed by the effective-dating engine, and initial assignment automatically satisfies Setup Step 8 (Organization Responsibility)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initial Organization Responsibility Assignment (Priority: P1)

As an HR Administrator configuring a new or existing company, I want to designate an individual employee as the Point of Contact (PoC) for a specific functional responsibility (such as HR Head, Finance Head, Country Head, IT Head, or Payroll Owner) with a future effective date, so that organizational leadership roles are officially tracked and company onboarding milestones are satisfied.

**Why this priority**: Initial assignment is the core entry point for designating organizational responsibilities and is required to complete Company Setup Step 8 (Organization Responsibility), unblocking overall company setup progression and organizational governance.

**Independent Test**: Can be tested by selecting an active employee, assigning them to an unassigned responsibility type (e.g., `HR_HEAD`) with an effective date at least as early as the next business day, and verifying that the assignment is scheduled and Company Setup Step 8 is marked completed.

**Acceptance Scenarios**:

1. **Given** an unassigned responsibility type (e.g., `HR_HEAD`) in a company and an active employee, **When** an Administrator assigns the employee to this responsibility with a valid future effective date, **Then** the system schedules the assignment, records the future effective transition, and marks Company Setup Step 8 (Organization Responsibility) as completed.
2. **Given** an invalid or inactive employee reference, **When** an Administrator attempts to assign that employee as a PoC, **Then** the system rejects the assignment and informs the user of the invalid employee status.
3. **Given** an effective date set to the current day or in the past, **When** an Administrator submits a PoC assignment, **Then** the system rejects the request requiring the effective date to be scheduled for the next business day or later.
4. **Given** a responsibility type that is not in the recognized responsibility allow-list, **When** an Administrator attempts to assign an employee, **Then** the system rejects the submission with an invalid responsibility type error.

---

### User Story 2 - Responsibility Replacement and Historical Tracking (Priority: P2)

As an HR Administrator managing evolving company operations, I want to schedule the replacement of an existing Point of Contact with a new individual on a designated future effective date, so that role transitions are seamless, historical assignments remain intact, and pending transitions take effect automatically on schedule.

**Why this priority**: Leadership and functional roles change over time. Enabling future-dated handoffs ensures continuous governance without disrupting current active operations or losing historical audit records.

**Independent Test**: Can be tested by taking an active PoC assignment, scheduling a replacement with a new employee effective on a future date, verifying that the current PoC remains active until the effective date arrives, and verifying that once the effective date is reached, the prior assignment is archived and the new assignment becomes active.

**Acceptance Scenarios**:

1. **Given** an active PoC assignment (e.g., `FINANCE_HEAD`), **When** an Administrator submits a replacement with another active employee and a future effective date, **Then** the system schedules the replacement change in pending status, leaves the current PoC active, and prevents immediate role overwriting.
2. **Given** an active PoC assignment that already has a scheduled pending replacement, **When** an Administrator attempts to schedule another replacement or deactivation for the same PoC, **Then** the system rejects the request enforcing the single-pending-change rule.
3. **Given** a scheduled replacement reaching its effective date, **When** the scheduled execution runs, **Then** the previous holder's assignment is archived to inactive status, the new holder's assignment becomes active, and an audit event is published.

---

### User Story 3 - Responsibility Deactivation (Priority: P3)

As an HR Administrator, I want to schedule the deactivation of a functional responsibility when a particular role is phased out or no longer required for a company, ensuring that historical records are preserved.

**Why this priority**: Allows organizations to retire responsibilities gracefully while preserving audit history and ensuring that no unauthorized or ghost assignments remain active.

**Independent Test**: Can be tested by scheduling deactivation of an active PoC, verifying that it transitions to inactive status upon reaching the effective date, and verifying that historical records reflect the full period of active responsibility.

**Acceptance Scenarios**:

1. **Given** an active PoC assignment without pending changes, **When** an Administrator schedules deactivation with a future effective date, **Then** the system records the pending deactivation change.
2. **Given** a scheduled deactivation reaching its effective date, **When** the scheduled execution runs, **Then** the PoC status transitions to inactive and the role becomes available for new assignment if re-introduced in the future.

---

### User Story 4 - Multi-Responsibility and Multi-Company Assignments (Priority: P3)

As an HR Administrator managing multi-entity structures, I want a single individual to be eligible to hold multiple distinct responsibility types within a single company (e.g., holding both `FINANCE_HEAD` and `IT_HEAD`) and hold responsibilities across multiple sibling companies simultaneously.

**Why this priority**: Real-world organizational leadership often consolidates functional responsibilities under key executives, especially in startup subsidiaries or shared services teams.

**Independent Test**: Can be tested by assigning Employee X as `HR_HEAD` and `FINANCE_HEAD` in Company A, and as `HR_HEAD` in Company B, verifying all assignments persist and function independently.

**Acceptance Scenarios**:

1. **Given** an employee already assigned as `HR_HEAD` in Company A, **When** an Administrator assigns the same employee as `FINANCE_HEAD` in Company A, **Then** the system accepts and schedules the assignment successfully.
2. **Given** an employee assigned as `COUNTRY_HEAD` in Company A, **When** an Administrator assigns the same employee as `COUNTRY_HEAD` in sibling Company B, **Then** the system accepts and schedules the assignment in Company B independently without cross-tenant or cross-company interference.

---

### User Story 5 - Querying Active Responsibilities and Assignment History (Priority: P4)

As an HR Business User or Administrator, I want to view the current active Point of Contact directory for a company as well as full assignment history and pending changes, so that I can audit role assignments and see upcoming leadership changes.

**Why this priority**: Provides operational visibility and governance auditing for compliance and day-to-day organizational coordination.

**Independent Test**: Can be tested by retrieving the company's PoC list, verifying active assignments include employee details, and retrieving the history log to view past and pending assignments.

**Acceptance Scenarios**:

1. **Given** a company with active and scheduled PoCs, **When** an authorized user requests the current PoC directory, **Then** the system returns only active PoC assignments with resolved employee details.
2. **Given** a company with past archived assignments and upcoming pending changes, **When** an authorized user requests the assignment history, **Then** the system returns a chronological record of all past, present, and pending transitions.

---

### Edge Cases

- **Concurrent Assignment Conflict**: What happens when two administrators attempt to assign or replace a PoC for the same responsibility type in the same company simultaneously? The system must reject the conflicting submission and enforce that only one active or scheduled assignment exists per responsibility type per company.
- **Assigned Employee Termination / Inactivation**: What happens when an employee holding an active PoC role is terminated or inactivated in the employee directory? The system preserves the existing PoC record and surfaces a warning or flag in the interface indicating the holder is inactive, requiring administrator intervention rather than silently auto-deactivating the organizational responsibility.
- **Immediate / Same-Day Modifications**: What happens when an administrator attempts to assign or modify a PoC with today's date? The system enforces the effective-dating policy requiring effective dates to be $\ge$ the start of the next business day (future-dated).
- **Duplicate Pending Change Requests**: What happens if an administrator tries to submit multiple successive replacements for an active PoC before the first one takes effect? The system rejects subsequent requests until the pending change is either executed or cancelled.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support designation of Points of Contact (PoCs) strictly scoped to a specific Company.
- **FR-002**: System MUST validate responsibility types against a predefined allow-list of organizational roles (`COUNTRY_HEAD`, `HR_HEAD`, `FINANCE_HEAD`, `IT_HEAD`, `PAYROLL_OWNER`).
- **FR-003**: System MUST enforce that a company can have at most one active or scheduled Point of Contact for any given responsibility type at any point in time.
- **FR-004**: System MUST model PoC responsibilities as standalone entity assignments independent of structural organization units (Locations, Departments, Grades, Job Titles).
- **FR-005**: System MUST allow a single individual employee to concurrently hold multiple distinct responsibility types within the same company and/or across different companies.
- **FR-006**: System MUST validate that referenced individuals are active and recognized employees before scheduling an assignment or replacement.
- **FR-007**: System MUST enforce that all assignments, replacements, and deactivations have a mandatory effective date strictly in the future (minimum next business day).
- **FR-008**: System MUST support scheduling role replacements such that the incumbent remains active until the effective date arrives, at which point the incumbent is transitioned to inactive and the successor becomes active.
- **FR-009**: System MUST enforce a single-pending-change constraint per responsibility assignment, rejecting additional change requests while a scheduled change remains pending.
- **FR-010**: System MUST automatically record completion of Setup Step 8 (Organization Responsibility) in company setup tracking upon successful initial PoC assignment.
- **FR-011**: System MUST maintain an immutable audit trail of past, present, and scheduled PoC assignments and publish corresponding domain events upon state execution (`setting.poc.assigned`, `setting.poc.replaced`, `setting.poc.deactivated`).
- **FR-012**: System MUST restrict assignment, replacement, and deactivation operations to authenticated users with the Administrator role, while allowing HR Business Users to view current and historical assignments.
- **FR-013**: System MUST execute scheduled state transitions idempotently, safely handling duplicate execution signals without creating duplicate records or invalid state transitions.

### Key Entities

- **Point of Contact (PoC)**: Represents the assignment of an individual employee to a specific organizational responsibility within a company. Key attributes include Company identifier, Responsibility Type (e.g., HR Head, Finance Head), Employee reference, Status (`scheduled`, `active`, `inactive`), Effective Date, and audit timestamps.
- **Effective Change Record**: Tracks a scheduled pending mutation (initial assignment, replacement, or deactivation) awaiting its future effective execution date. Key attributes include Target Entity reference, Change Type (`CREATE`, `UPDATE`, `DEACTIVATE`), Effective Date, Change Payload, and Status (`pending`, `applied`, `cancelled`).
- **Company Setup Step**: Tracks the completion status of mandatory onboarding milestones for a company, specifically Setup Step 8 (Organization Responsibility).
- **Employee Reference**: A read-only local projection of employee profile and status used to validate individual eligibility and resolve display names for responsibility holders.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can schedule a new organizational responsibility assignment or replacement in under 1 minute.
- **SC-002**: 100% of scheduled PoC state transitions execute and reflect active status within 60 seconds of their scheduled effective timestamp.
- **SC-003**: 100% of conflicting assignment attempts (duplicate active holders per responsibility type per company or multiple pending changes) are reliably prevented and rejected.
- **SC-004**: 100% of initial PoC assignments automatically update and satisfy Company Setup Step 8 without manual operator intervention.
- **SC-005**: 100% of historical assignments and state transitions remain permanently auditable and retrievable via historical query endpoints.

## Assumptions

- **Allow-List Roles**: The organizational responsibility types are standard across all tenants (`COUNTRY_HEAD`, `HR_HEAD`, `FINANCE_HEAD`, `IT_HEAD`, `PAYROLL_OWNER`) and do not require dynamic custom category creation in this version.
- **Single Active Holder per Type**: Each responsibility type within a company has at most one primary active individual at any given time; co-holder / joint-delegation models are out of scope for v1.
- **Employee Directory Authority**: Authoritative employee creation, personal details, and employment termination are managed by the Directory domain; Setting Service maintains a synchronized read-only projection for validation and display.
- **Effective Date Threshold**: In accordance with system-wide effective-dating rules, the minimum effective date for future assignments is the start of the next business day (00:00:00 UTC / company business day boundary).
- **Tenant & Company Scoping**: All queries and mutations are strictly bounded by authenticated tenant and company contexts with cross-tenant data leakage strictly prohibited.
