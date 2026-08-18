# Feature Specification: Company Activation

**Feature Branch**: `013-company-activation`

**Created**: 2026-08-17

**Status**: Ready for Planning

**Input**: User description: "Backend Task Breakdown: Company Activation"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explicit Company Activation by Administrator (Priority: P1)

As an authenticated Administrator, I want to explicitly activate a company that has completed all 8 mandatory onboarding setup steps, so that the company becomes operational and downstream systems are notified of its active state.

**Why this priority**: Activating a company is the foundational gateway that transitions a newly provisioned tenant entity from initial setup to fully active operational status. Without this, no organization can begin live HR operations.

**Independent Test**: Can be fully tested by creating a company in `PENDING` status with all 8 setup steps marked as `COMPLETED`, invoking the activation endpoint as an Administrator, and verifying that the company status transitions to `ACTIVE`, activation metadata is captured, and the domain activation event is recorded in the outbox.

**Acceptance Scenarios**:

1. **Given** a Company in `PENDING` status belonging to the current tenant and all 8 setup steps (`COMPANY_INFO`, `LOCATION`, `DEPARTMENT`, `GRADE`, `JOB_TITLE`, `POINT_OF_CONTACT`, `ROLES`, `EMPLOYEE_IMPORT`) marked as `COMPLETED`, **When** the Administrator submits an activation request, **Then** the Company status updates to `ACTIVE`, `activated_at` and `activated_by` timestamps/audit records are populated, an activation domain event is transactionally recorded, and a success confirmation is returned.
2. **Given** a Company that is successfully activated, **When** downstream services consume the activation domain event, **Then** the event contains standard tenant, company, and activation metadata.

---

### User Story 2 - Rejection of Incomplete Setup Activation (Priority: P1)

As an authenticated Administrator, I want clear, structured feedback if I attempt to activate a company that still has incomplete setup steps, so that I can see exactly which onboarding steps need completion before retrying.

**Why this priority**: Enforces business governance and organizational completeness (INV-004) preventing incomplete or partially-configured companies from entering active operations.

**Independent Test**: Can be tested by setting up a company in `PENDING` status with one or more steps marked incomplete or missing, attempting activation, and verifying that activation is rejected with a structured list of outstanding steps while preserving `PENDING` status.

**Acceptance Scenarios**:

1. **Given** a Company in `PENDING` status where one or more setup steps (e.g., `DEPARTMENT` and `EMPLOYEE_IMPORT`) are incomplete or unconfigured, **When** an Administrator submits an activation request, **Then** the system rejects the activation with a structured error payload detailing all incomplete step types, and makes no state modifications to the Company.
2. **Given** an activation request that fails due to incomplete steps, **When** reviewing the database state, **Then** the Company remains strictly in `PENDING` status without partial activation writes or outbox event emissions.

---

### User Story 3 - Protection Against Invalid State Transitions & Unauthorized Access (Priority: P2)

As a system security and governance stakeholder, I want to ensure that only authorized Administrators within the tenant can activate companies, and that already active companies cannot be re-activated or transitioned illegally.

**Why this priority**: Protects tenant boundaries, enforces RBAC policies, and maintains the terminal immutability of the `ACTIVE` lifecycle state in this module.

**Independent Test**: Can be tested by attempting activation with non-admin roles, cross-tenant requests, or targeting an already `ACTIVE` company, and verifying appropriate access denial or state conflict errors.

**Acceptance Scenarios**:

1. **Given** an authenticated non-Administrator user (e.g., HR Business User), **When** attempting to activate a company, **Then** the system denies the request with a Forbidden error.
2. **Given** an Administrator authenticated under Tenant A, **When** attempting to activate a company belonging to Tenant B, **Then** the system returns a Not Found error without exposing cross-tenant data.
3. **Given** a Company that is already in `ACTIVE` status, **When** an Administrator attempts to trigger activation again, **Then** the system returns a conflict/unprocessable error indicating that the company is already active, leaving the company state unchanged.

---

### Edge Cases

- **Concurrent Activation Requests**: When two administrators attempt to activate the exact same company simultaneously, atomic transactional boundaries and status guards ensure only one transaction succeeds, while the other receives an already-active error.
- **Transactional Failure during Outbox Event Creation**: If an error occurs when writing the activation outbox event, the entire database transaction rolls back so the company remains in `PENDING` status with no partial side effects.
- **Missing Setup Step Records**: If any of the 8 mandatory setup step records are missing entirely from the tracking table, the validator treats them as incomplete and lists them in the rejection payload.
- **Zero Auto-Activation**: No automated background process or individual step completion trigger shall automatically flip a company to `ACTIVE`; activation requires an explicit user command.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an explicit activation command/endpoint for transitioning a company from `PENDING` status to `ACTIVE` status.
- **FR-002**: System MUST strictly prohibit automatic or implicit activation upon the completion of setup steps.
- **FR-003**: System MUST validate server-side against the live database state that all 8 mandatory setup steps (`COMPANY_INFO`, `LOCATION`, `DEPARTMENT`, `GRADE`, `JOB_TITLE`, `POINT_OF_CONTACT`, `ROLES`, `EMPLOYEE_IMPORT`) are marked `COMPLETED` at the exact moment of activation.
- **FR-004**: If any of the 8 mandatory setup steps are not completed, the system MUST reject the activation and return a structured response listing all outstanding incomplete step types.
- **FR-005**: System MUST record the activating user identity and activation timestamp when a company transitions to `ACTIVE`.
- **FR-006**: System MUST persist a domain event (`company.activated`) into the transactional outbox within the exact same database transaction that updates the company status.
- **FR-007**: System MUST treat `ACTIVE` status as terminal within the company setup context, rejecting subsequent activation attempts for companies that are already `ACTIVE`.
- **FR-008**: System MUST enforce multi-tenant isolation by scoping company lookup and mutations strictly by the authenticated tenant context.
- **FR-009**: System MUST enforce Role-Based Access Control, restricting company activation actions strictly to users with the Administrator role.

### Key Entities *(include if feature involves data)*

- **Company**: Represents an organizational tenant subsidiary entity. Core attributes relevant to activation include `id`, `tenantId`, `status` (`PENDING` | `ACTIVE`), `activatedAt`, `activatedBy`, and audit timestamps.
- **CompanySetupStep**: Represents the progress tracking record for an onboarding setup step. Includes `companyId`, `stepType` (one of 8 mandatory types), and `status` (`NOT_STARTED` | `IN_PROGRESS` | `COMPLETED`).
- **OutboxEvent**: Represents transactional domain events to be reliably dispatched to message brokers. Core attributes include `id`, `tenantId`, `aggregateType`, `aggregateId`, `eventType` (`company.activated`), `payload`, `partitionKey`, and status tracking.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of activation requests for companies with incomplete setup steps are blocked with a precise, complete list of missing steps.
- **SC-002**: 100% of successful company activations commit company status update and domain event creation within an atomic database transaction.
- **SC-003**: 0% cross-tenant data leakage or unauthorized status changes permitted under non-administrator roles or foreign tenant contexts.
- **SC-004**: 0% implicit or automatic activations occur without an explicit Administrator activation action.

## Assumptions

- The 8 mandatory setup steps conform to the standardized setup step enumerations defined across the domain (`COMPANY_INFO`, `LOCATION`, `DEPARTMENT`, `GRADE`, `JOB_TITLE`, `POINT_OF_CONTACT`, `ROLES`, `EMPLOYEE_IMPORT`).
- The transactional outbox pattern implementation and shared message envelope standards are established in the service architecture.
- Re-activation or status reversion to `PENDING` is not permitted once a company achieves `ACTIVE` status.
