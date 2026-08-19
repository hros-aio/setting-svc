# Feature Specification: Employee Transfer Between Companies

**Feature Branch**: `016-employee-transfer`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Backend Task Breakdown: Employee Transfer Between Companies - Provide a controlled, auditable, effective-dated backend workflow to transfer an employee from an originating Company to an active destination Company within the same Tenant. The process models continuous employment (not termination/re-hire), keeps active attribution under the originating Company until effectiveAt (>= end of current business day), transitions attribution to the destination Company upon reaching effectiveAt, preserves historical employment records, and synchronizes downstream domains via transactional outbox events."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scheduling an Inter-Company Employee Transfer (Priority: P1)

As an HR Administrator, I want to initiate and schedule the transfer of an employee from their current (source) Company to a new (destination) Company within the same Tenant, specifying future organizational assignments (Destination Location, Department, Grade, Job Title) and a mandatory future Effective Date, so that organizational movement is planned ahead without prematurely interrupting current company operations.

**Why this priority**: Inter-company employee mobility is a core business operation in multi-company enterprises. Scheduling a transfer with a future effective date is the primary entry point for managing employee transitions while guaranteeing that current operations and active employment records in the originating company remain intact until the transition point.

**Independent Test**: Can be tested by selecting an active employee in Company A, submitting a transfer request to an active Company B with a valid future effective date and valid destination master data (Location, Department, Grade, Job Title), and verifying that the transfer is recorded in `PENDING` status while the employee's active attribution remains under Company A.

**Acceptance Scenarios**:

1. **Given** an active employee attributed to Company A and an active destination Company B within the same Tenant, **When** an Administrator submits a transfer request with a future effective date ($\ge$ end of the current business day) and valid destination master data belonging to Company B, **Then** the system accepts the request, persists the transfer in `PENDING` status, schedules the future execution, and maintains the employee's active attribution to Company A.
2. **Given** a transfer request submitted without an effective date or with an effective date earlier than the end of the current business day, **When** an Administrator attempts to schedule the transfer, **Then** the system rejects the submission with a validation error requiring a future effective date.
3. **Given** an employee who already has an unexecuted transfer in `PENDING` status, **When** an Administrator attempts to schedule another transfer for the same employee, **Then** the system rejects the request, enforcing that at most one pending transfer can exist per employee at any given time.

---

### User Story 2 - Automated Execution and Continuous Employment Attribution Transition (Priority: P1)

As an HR Administrator and Organization Stakeholder, I want the system to automatically transition an employee's active company attribution and master data assignments to the destination Company once the designated Effective Date arrives, without treating the movement as a termination or re-hire, so that continuous tenure is preserved and downstream systems receive synchronized updates.

**Why this priority**: The business value of scheduling is realized when the transition executes seamlessly on schedule. Preserving continuous employment without termination/re-hire workflows is vital for legal compliance, seniority tracking, benefits continuity, and cross-domain synchronization.

**Independent Test**: Can be tested by taking a `PENDING` transfer reaching its effective date, triggering the execution workflow, and verifying that the transfer transitions to `COMPLETED`, the employee's active company attribution shifts to Company B, previous assignment records in Company A remain preserved as historical records, and downstream domain synchronization events are emitted.

**Acceptance Scenarios**:

1. **Given** a pending transfer whose effective date has been reached, **When** the scheduled execution executes, **Then** the transfer record is marked as `COMPLETED`, the employee's active attribution is updated to Company B with the designated master data, the historical tenure in Company A is preserved, and a domain synchronization event is staged for downstream systems (Access, Time, Payroll).
2. **Given** a duplicate or re-delivered execution trigger for an already completed or executing transfer, **When** the execution handler processes the trigger, **Then** the system deduplicates the request and prevents redundant or conflicting state transitions.

---

### User Story 3 - Destination Master Data & Company Status Verification (Priority: P2)

As an HR Administrator, I want the system to strictly validate that the destination Company is active and that all assigned organizational master data (Location, Department, Grade, Job Title) belong exclusively to the destination Company and are active, so that cross-company data contamination and invalid organizational references are prevented.

**Why this priority**: Multi-company data isolation is an essential architectural invariant. Invalid or cross-company organizational assignments would corrupt organizational reporting, payroll routing, and access permissions.

**Independent Test**: Can be tested by attempting to submit transfer requests with: (1) a destination company in `PENDING` status, (2) a Job Title belonging to Company A rather than destination Company B, or (3) an inactive department in Company B, and verifying that all such requests are rejected with explicit business errors.

**Acceptance Scenarios**:

1. **Given** a destination Company in `PENDING` (non-active) status, **When** an Administrator submits a transfer to that company, **Then** the system rejects the request with an error indicating that the destination company is not active.
2. **Given** a transfer request where a specified master data entity (e.g., Job Title, Department, Location, or Grade) belongs to a company other than the destination Company, **When** the transfer request is validated, **Then** the system rejects the request due to cross-company entity mismatch.
3. **Given** a transfer request where a specified destination master data entity is inactive or deleted, **When** validated, **Then** the system rejects the request requiring active destination master data.

---

### User Story 4 - Querying Pending Transfers and Employment Transfer Audit History (Priority: P3)

As an HR Administrator or Compliance Auditor, I want to query the current pending transfer for an employee as well as the full historical timeline of company transfers and tenures, so that I have complete visibility into upcoming organizational transitions and historical employment records.

**Why this priority**: Operational visibility and statutory compliance require accessible audit logs of all company transfers, tenures, and pending organizational shifts.

**Independent Test**: Can be tested by retrieving pending transfer details for an employee with an active pending transfer, and retrieving the transfer history endpoint for an employee who has undergone multiple transfers, verifying that all historical records and timestamps are accurate and complete.

**Acceptance Scenarios**:

1. **Given** an employee with a pending transfer, **When** an authorized user queries the pending transfer endpoint for that employee, **Then** the system returns the pending transfer details including source company, destination company, destination master data, and scheduled effective date.
2. **Given** an employee with past completed transfers, **When** an authorized user queries the transfer history endpoint, **Then** the system returns a chronological list of all transfer events, effective dates, and past company tenures.
3. **Given** an unauthorized or non-administrator user attempting to query transfer records, **When** requesting transfer details, **Then** the system denies access with an authorization error.

---

### Edge Cases

- **Destination Company Inactivation Before Effective Date**: What happens if the destination Company is deactivated or suspended after a transfer is scheduled but before the `effectiveAt` date arrives? The execution handler validates the destination company's `ACTIVE` status at execution time; if the destination company is no longer active, execution fails gracefully and flags the transfer for administrative review.
- **Concurrent Pending Transfer Submission**: What happens when two administrators simultaneously attempt to initiate a transfer for the same employee? Database-level partial unique constraints (`uq_employee_pending_transfer`) reject the concurrent insertion, ensuring strictly at most one pending transfer exists per employee.
- **Same-Day / Immediate Transfer Requests**: What happens when an administrator specifies an effective date equal to today or in the past? The system rejects the request, strictly enforcing that `effectiveAt` must be greater than or equal to the end of the current business day.
- **Continuous Employment vs. Termination Side Effects**: What happens during transfer execution to the employee's existing profile and tenure? The system explicitly models the change as continuous employment; seniority date and employment records are retained, and no termination or re-hire workflows are triggered.
- **Cross-Tenant Isolation Breach Attempt**: What happens if a transfer request specifies a destination company belonging to a different tenant? The system rejects the request immediately, strictly enforcing tenant boundary isolation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an endpoint for authenticated HR Administrators to initiate and schedule an inter-company employee transfer within the same tenant.
- **FR-002**: System MUST validate that the destination Company exists, belongs to the same tenant, and is in `ACTIVE` status before accepting a transfer request.
- **FR-003**: System MUST validate that the employee exists, belongs to the source Company, and does not have an existing `PENDING` transfer.
- **FR-004**: System MUST enforce that the scheduled Effective Date (`effectiveAt`) is strictly greater than or equal to the end of the current business day (mandatory future date).
- **FR-005**: System MUST validate that any provided destination organizational master data (`destination_location_id`, `destination_department_id`, `destination_grade_id`, `destination_job_title_id`) belong exclusively to the destination Company and are in `ACTIVE` status.
- **FR-006**: System MUST persist the transfer record with status `PENDING` upon successful initiation without altering the employee's active attribution prior to `effectiveAt`.
- **FR-007**: System MUST atomically stage a scheduling outbox event in the same transaction as the transfer record creation.
- **FR-008**: System MUST maintain active employee attribution and directory assignment under the originating (source) Company until the scheduled `effectiveAt` is reached.
- **FR-009**: System MUST automatically execute pending transfers upon reaching their `effectiveAt`, transitioning the transfer status from `PENDING` to `COMPLETED`.
- **FR-010**: System MUST transition active employee attribution to the destination Company upon execution, updating active company and master data assignments while preserving all historical company tenure records.
- **FR-011**: System MUST model the inter-company transfer as continuous employment and MUST NOT trigger termination, offboarding, or re-hire processes.
- **FR-012**: System MUST stage a transactional outbox domain event (`employee.company-transferred` / `setting.employee-transfer.events`) upon successful execution to notify downstream domains (Access, Time, Payroll).
- **FR-013**: System MUST enforce deduplication and idempotency on execution commands to prevent redundant execution of transfers.
- **FR-014**: System MUST enforce database-level unique constraints to guarantee that an employee has at most one pending transfer at any given time.
- **FR-015**: System MUST provide endpoints for authorized users to query the active pending transfer and historical transfer timeline for an employee.

### Key Entities

- **Employee Transfer (`employee_transfers`)**: Represents an inter-company movement request for an employee. Tracks tenant ID, employee ID, source company ID, destination company ID, destination master data assignments (location, department, grade, job title), status (`PENDING`, `COMPLETED`, `CANCELLED`), scheduled effective date (`effective_at`), and audit timestamps (`created_at`, `updated_at`).
- **Employee Reference (`employee_references`)**: Represents the local projection of employee attribution within the Setting Service. Tracks the employee's current active company ID, status, and master data associations.
- **Transactional Outbox Event (`outbox_events`)**: Represents the atomic outbox queue for scheduling triggers (`setting.effective-change.scheduled`) and domain synchronization notifications (`employee.company-transferred`) published to Kafka.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of inter-company transfer requests enforce future-dated boundary checks ($\ge$ end of current business day) and destination company active status validation.
- **SC-002**: 100% of transfer executions preserve historical employment records without triggering termination or re-hire workflows, achieving continuous employment tracking.
- **SC-003**: 0% duplicate or conflicting pending transfers can be created for any individual employee, verified by database-level partial unique constraint enforcement.
- **SC-004**: Atomicity between transfer state persistence and outbox event scheduling achieves 100% consistency with zero dual-write discrepancy.
- **SC-005**: Authorized Administrators can initiate a transfer and retrieve transfer audit histories in under 2 seconds.

## Assumptions

- Both source and destination companies belong to the same Tenant; cross-tenant employee transfers are not supported.
- Employee master data and identity records are owned by the Directory Domain; the Setting Service validates organizational master data and tracks local employee company attribution projections.
- Organization Responsibility / Point of Contact (PoC) roles held by the employee in the source company are handled independently by the PoC module and are not automatically reassigned as part of the structural transfer workflow.
- Transfer modification and cancellation workflows before `effectiveAt` will be formalized in a future enhancement; the initial release enforces initiation, validation, and automated execution.
