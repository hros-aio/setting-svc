# Feature Specification: Company Information Completion

**Feature Branch**: `005-company-information-completion`

**Created**: 2026-08-15

**Status**: Draft

**Input**: User description: "Backend Task Breakdown: Company Information Completion"

## Clarifications

### Session 2026-08-15
- Q: How should the common idempotency key generator and cache locking strategy be structured across company mutation endpoints? → A: Option A: Centralize key generation into a shared utility function `buildIdempotencyKey(tenantId, key, resourceType, resourceId?)` using a unified Redis cache format (`idempotency:company:${tenantId}:${idempotencyKey}`) with consistent 24h TTL and in-flight mutex lock to prevent concurrent database conflicts across create and update flows.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initial Completion of Company Information for Pending Company (Priority: P1)

As an authenticated Tenant Administrator, I want to review and complete the legal entity and profile information for a newly created or pending company, so that foundational organizational metadata is established and Step 1 (`COMPANY_INFORMATION`) in the mandatory company setup checklist is marked complete.

**Why this priority**: Completing company information is the first prerequisite step in the company onboarding sequence (Step 1). Without completing this step, the company cannot progress through downstream setup stages or achieve active operational status.

**Independent Test**: Can be tested by updating a `PENDING` company that has its `COMPANY_INFORMATION` setup step in `INCOMPLETE` status with valid company information. Verification confirms that company attributes are persisted, completion audit metadata (`information_completed_at`, `information_completed_by`) is populated, setup step 1 transitions to `COMPLETED`, and a domain event is scheduled in the transactional outbox.

**Acceptance Scenarios**:

1. **Given** an authenticated Tenant Administrator and a company in `PENDING` status with `COMPANY_INFORMATION` step marked `INCOMPLETE`
   **When** the administrator submits valid company profile information (including name, currency, timezone, country, and optional legal details)
   **Then** the company record is updated, `information_completed_at` and `information_completed_by` are recorded, and the `COMPANY_INFORMATION` setup step transitions to `COMPLETED`.
2. **Given** a valid company information completion request
   **When** the database transaction commits
   **Then** a company update domain event is atomically recorded in the transactional outbox with the company and tenant context.
3. **Given** a company with pre-filled legal details from registration
   **When** the administrator completes the setup step without altering pre-filled legal attributes
   **Then** the pre-filled legal information is preserved as valid and the setup step is marked `COMPLETED`.

---

### User Story 2 - Profile and Legal Entity Information Updates for Active or Configured Company (Priority: P2)

As an authenticated Tenant Administrator, I want to update profile attributes (such as legal name, tax ID, timezone, or name) for an existing or active company, so that organizational changes are accurately maintained over time without disrupting existing setup step completion states.

**Why this priority**: Companies frequently undergo administrative adjustments (e.g., tax ID registration, legal name updates, contact adjustments). The system must allow ongoing maintenance of company details without corrupting completed setup workflows.

**Independent Test**: Can be tested by submitting attribute changes to an `ACTIVE` company or a company whose `COMPANY_INFORMATION` step is already `COMPLETED`, verifying that changes persist, updated timestamps are refreshed, existing `COMPLETED` step status is preserved, and a domain event is generated.

**Acceptance Scenarios**:

1. **Given** an `ACTIVE` company whose `COMPANY_INFORMATION` setup step is already `COMPLETED`
   **When** the administrator submits updated profile attributes (e.g., updated `legal_name` and `tax_id`)
   **Then** the company record is updated with new values, the `updated_at` timestamp is refreshed, and the setup step remains in `COMPLETED` status without error.
2. **Given** an authenticated administrator updating an existing company
   **When** only a subset of profile attributes is provided in the request
   **Then** only the specified attributes are modified while unmodified attributes retain their existing values.

---

### User Story 3 - Input Validation and Multi-Tenant Isolation Enforcement (Priority: P3)

As a System Security and Compliance Officer, I want the system to enforce strict format validation on all company metadata and ensure tenant boundaries are strictly respected, so that invalid data is rejected and unauthorized cross-tenant modifications are completely prevented.

**Why this priority**: Protects data integrity across the platform and enforces strict tenant multi-tenancy and data isolation compliance.

**Independent Test**: Can be tested by submitting invalid currency codes, malformed country codes, or targeting company IDs belonging to other tenants, verifying appropriate validation errors and total rejection of cross-tenant requests.

**Acceptance Scenarios**:

1. **Given** a company information submission with an invalid currency code or malformed country code
   **When** the request is evaluated
   **Then** the request is rejected with a validation error detailing the invalid fields, and no database changes occur.
2. **Given** an authenticated administrator from Tenant A attempting to update a company belonging to Tenant B
   **When** the request is processed
   **Then** the system returns a not found / unauthorized error and prevents any inspection or modification of Tenant B's data.
3. **Given** a duplicate update request submitted with an identical idempotency key
   **When** the system receives the duplicate request
   **Then** the system returns the cached successful response without executing duplicate database mutations or generating duplicate outbox events.

---

### Edge Cases

- **Cross-Tenant Access Attempt**: Any attempt to read or mutate company information across tenant boundaries must fail with a resource not found or access denied error.
- **Non-Existent or Invalid Lifecycle Status**: Attempting to update a company that does not exist or is in an unsupported lifecycle status must be rejected without altering any records.
- **Partial Database Failure**: If persisting setup step status or writing outbox events fails during the transaction, all company entity modifications must be rolled back completely to maintain transactional consistency.
- **Idempotent Step Completion**: Updating company information multiple times after initial completion must succeed cleanly without resetting completion history or throwing step state transition errors.
- **Pre-filled Registration Metadata**: Registration data pre-filled during initial tenant provisioning must be treated as valid and not inherently incomplete when evaluating baseline criteria.
- **Idempotency Key Collisions across Create/Update**: Standardize idempotency key generation via a shared utility (`buildIdempotencyKey`) with tenant and resource context to prevent duplicate writes or race conditions on rapid retries.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST restrict company information review and update operations exclusively to authenticated users with Administrator privileges.
- **FR-002**: System MUST enforce strict multi-tenant data isolation by scoping all queries and mutations to the authenticated tenant identifier (`tenant_id`).
- **FR-003**: System MUST permit updates to company profile attributes including display name (`name`), legal entity name (`legal_name`), tax identification number (`tax_id`), currency (`currency`), primary timezone (`timezone`), and country code (`country`).
- **FR-004**: System MUST validate that `currency` adheres to the standard 3-letter ISO-4217 format, `country` adheres to the 2-letter ISO-3166-1 alpha-2 format, and `timezone` is a valid IANA timezone identifier.
- **FR-005**: System MUST treat legal entity metadata pre-filled during initial tenant registration as valid and editable baseline data.
- **FR-006**: System MUST mark Setup Step 1 (`COMPANY_INFORMATION`) in `company_setup_steps` as `COMPLETED` when valid baseline company profile information (`name`, `country`, `currency`, `timezone`) is confirmed and saved for a `PENDING` company.
- **FR-007**: System MUST record the completion timestamp (`information_completed_at`) and the actor identifier (`information_completed_by`) upon saving company information.
- **FR-008**: System MUST maintain the `COMPLETED` state of the `COMPANY_INFORMATION` setup step without error when subsequent profile updates occur on an already completed or `ACTIVE` company.
- **FR-009**: System MUST emit a company update domain event via the Transactional Outbox pattern within the exact same database transaction that persists the company profile and setup step changes.
- **FR-010**: System MUST support idempotency keys on update requests to prevent duplicate processing or redundant event publishing on network retries.
- **FR-011**: System MUST only permit company information completion and updates on companies in `PENDING` or `ACTIVE` status.
- **FR-012**: System MUST generate idempotency cache keys using a common standardized helper function (`buildIdempotencyKey`) across create and update operations to guarantee consistent scoping and prevent database write conflicts.

### Key Entities *(include if feature involves data)*

- **Company**: Represents an independent legal entity under a tenant. Key profile attributes include `id`, `tenant_id`, `name`, `legal_name`, `tax_id`, `currency`, `timezone`, `country`, `status` (`PENDING`, `ACTIVE`), `information_completed_at`, `information_completed_by`, and `updated_at`.
- **Company Setup Step**: Represents an individual onboarding milestone for a company. Key attributes include `id`, `tenant_id`, `company_id`, `step_type` (`COMPANY_INFORMATION`), `status` (`INCOMPLETE`, `COMPLETED`), `completed_at`, and `completed_by`.
- **Outbox Event**: Transactional record capturing pending domain events (e.g., `company.updated` / `company.information-completed`) for reliable, atomic asynchronous publishing to downstream message brokers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can update and complete company profile information in under 1 second per request.
- **SC-002**: 100% of successful company information completions for pending companies transition Setup Step 1 (`COMPANY_INFORMATION`) to `COMPLETED` with audit timestamps and user attribution.
- **SC-003**: 100% of company updates, setup step transitions, and outbox event records commit atomically in a single database transaction, ensuring zero partial state divergence.
- **SC-004**: 100% of cross-tenant access and modification attempts are blocked, ensuring zero data leakage across tenant boundaries.
- **SC-005**: 100% of duplicate requests with identical idempotency keys return consistent responses without generating duplicate domain events.

## Assumptions

- Baseline mandatory fields for Setup Step 1 completion are `name`, `country`, `currency`, and `timezone`; `legal_name` and `tax_id` remain optional metadata unless explicitly mandated by regional regulatory requirements.
- Legal entity information pre-populated during initial tenant onboarding is treated as valid baseline data until modified by an Administrator.
- Setting Service is the sole authoritative system of record for `companies` and `company_setup_steps`.
- Asynchronous consumers listening to outbox events will handle downstream synchronization (e.g., employee or payroll service notifications) independently based on published events.
