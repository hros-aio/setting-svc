# Feature Specification: Default Company Designation

**Feature Branch**: `006-default-company-designation`

**Created**: 2026-08-15

**Status**: Draft

**Input**: User description: "Backend Task Breakdown: Default Company Designation"

## Clarifications

### Session 2026-08-15
- Q: Does updating the default company need to publish an asynchronous domain event? → A: No. Domain event publishing is not required when changing the default company designation.
- Q: What is the baseline assumption for tenant default company state? → A: Every tenant already has a default company created by default during tenant provisioning.
- Q: How should changing the default company operate? → A: As a designation transfer/conversion from the current source default company to the specified target company within the tenant.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transfer Default Company Designation to Target Company (Priority: P1)

As an authenticated Tenant Administrator, I want to change the tenant's Default Company by selecting a target company, so that its configuration and structural settings become the active default template for future company creations and organizational defaults.

**Why this priority**: Core feature requirement. Tenant administrators need the ability to transfer the default company designation when organizational hierarchies or primary legal entities evolve.

**Independent Test**: Can be tested on a tenant with an existing default company (Company A) by requesting designation transfer to Company B. Verification confirms that Company A's `is_template` is updated to `false` and Company B's `is_template` is updated to `true` in the database, with no event published.

**Acceptance Scenarios**:

1. **Given** an authenticated Tenant Administrator and a tenant where Company A is the current default company (`is_template = true`)
   **When** the administrator designates Company B as the new default company
   **Then** Company A has `is_template = false`, Company B has `is_template = true`, and the response returns Company B's updated representation reflecting `isTemplate: true`.
2. **Given** an authenticated Tenant Administrator designating a company that is already the default company (Company A)
   **When** the designation transfer request is submitted
   **Then** the operation completes idempotently without error and preserves Company A as the default company.

---

### User Story 2 - Atomic Conversion Guarantee & Invariant Enforcement (Priority: P2)

As a System Reliability Engineer, I want the transfer from the source default company to the target company to execute atomically within a single database transaction, so that at no point does a tenant have zero or multiple default companies.

**Why this priority**: Enforces the single default company invariant per tenant at all times.

**Independent Test**: Can be tested under concurrent designation requests or simulated transaction interruptions, confirming that database-level partial unique constraints and transactional atomicity prevent invalid states.

**Acceptance Scenarios**:

1. **Given** a valid designation transfer request targeting Company B
   **When** the transaction executes
   **Then** clearing Company A and setting Company B commit atomically in the database.
2. **Given** a database failure during designation transfer
   **When** the transaction fails
   **Then** all modifications roll back completely, leaving the original default company intact.

---

### User Story 3 - Access Control and Multi-Tenant Isolation (Priority: P3)

As a System Security and Compliance Officer, I want designation requests to strictly verify administrative permissions and enforce tenant isolation, so that non-administrative users cannot change default company designations and cross-tenant designations are strictly blocked.

**Why this priority**: Protects critical organizational configuration settings from unauthorized modifications and prevents data cross-contamination across tenants.

**Independent Test**: Can be tested by attempting designation with non-admin credentials, unauthenticated requests, or targeting company identifiers belonging to another tenant, confirming appropriate authorization rejections and complete tenant isolation.

**Acceptance Scenarios**:

1. **Given** an authenticated user without Administrator privileges (e.g., standard business user)
   **When** attempting to designate a default company
   **Then** the request is rejected with an access forbidden error.
2. **Given** an unauthenticated request
   **When** attempting to designate a default company
   **Then** the request is rejected with an authentication required error.
3. **Given** an authenticated Administrator of Tenant A attempting to designate a company belonging to Tenant B (or a non-existent company)
   **When** the designation request is processed
   **Then** the request is rejected with a not found error, and no modifications occur in either tenant.

---

### Edge Cases

- **Concurrent Designation Race Condition**: If two administrators attempt to designate different companies as default simultaneously, database-level uniqueness constraints (`uq_companies_one_template_per_tenant`) guarantee that only one company can hold the active default designation per tenant at any given moment.
- **Transactional Atomicity Failure**: If updating the target company fails at any point during execution, all changes (including clearing the prior default company) must be rolled back completely.
- **Designating Companies in Different Lifecycle Statuses**: Both `PENDING` and `ACTIVE` companies belonging to the tenant may be designated as the default company.
- **Idempotent Re-Designation**: Repeatedly designating the currently active default company must succeed cleanly without throwing errors or creating unnecessary state divergence.
- **Cross-Tenant Targeting**: Target company identifiers not belonging to the authenticated tenant must be treated as non-existent (returning not found) to prevent tenant metadata probing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow an authenticated Administrator to transfer the Default Company designation to a target company within their tenant.
- **FR-002**: System MUST assume that every tenant already has a default company designated upon tenant creation.
- **FR-003**: System MUST enforce the invariant that exactly one company per tenant can hold the default company designation (`is_template = true`) at any given time.
- **FR-004**: System MUST automatically and atomically clear the `is_template` flag from the current source default company when transferring designation to the target company.
- **FR-005**: System MUST persist the updated default company designation flag (`is_template`) on the company records within a single database transaction.
- **FR-006**: System MUST enforce database-level uniqueness for the default company designation per tenant via partial unique index `uq_companies_one_template_per_tenant`.
- **FR-007**: System MUST NOT publish asynchronous domain events to outbox or message broker for default company designation updates.
- **FR-008**: System MUST handle transferring designation to a company that is already the default company idempotently without throwing errors.
- **FR-009**: System MUST reject default designation requests with an access forbidden error if the user lacks Administrator privileges.
- **FR-010**: System MUST reject default designation requests with an authentication required error if the request is unauthenticated.
- **FR-011**: System MUST strictly isolate tenant data and reject designation requests targeting companies that do not exist or belong to another tenant with a not found error.
- **FR-012**: System MUST permit designation of companies in either `PENDING` or `ACTIVE` lifecycle status within the tenant.

### Key Entities *(include if feature involves data)*

- **Company**: Represents an organization or subsidiary entity within a tenant. Key attributes include `id`, `tenant_id`, `company_code`, `name`, `status` (`PENDING`, `ACTIVE`), `is_template` (boolean indicating if the company serves as the default configuration template), and timestamps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can transfer default company designation in under 300 milliseconds.
- **SC-002**: 100% of tenants maintain exactly one company with default company designation (`is_template = true`) at all times.
- **SC-003**: 100% of default company designation transfers (clearing source and setting target) commit atomically in a single database transaction with zero partial state divergence.
- **SC-004**: 100% of unauthorized or cross-tenant designation attempts are blocked without data exposure or modification.
- **SC-005**: 100% of re-designation requests for an already default company complete successfully and idempotently.

## Assumptions

- Every tenant has an initial default company created during tenant provisioning.
- Default company designation serves as an internal template marker for configuration replication within Setting Service.
- No downstream domain events are needed for default company designation updates.
- The Setting Service is the authoritative owner and source of truth for `companies` and their `is_template` designation.


