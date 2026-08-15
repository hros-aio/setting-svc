# Feature Specification: Additional Company Creation

**Feature Branch**: `004-additional-company-creation`

**Created**: 2026-08-15

**Status**: Draft

**Input**: User description: "Backend Task Breakdown: Additional Company Creation"

## Clarifications

### Session 2026-08-15
- Q: Clarification on 'Not copy poc in flow create new company': How should the PoC (Organization Responsibility) step and copyable categories behave during company creation? → A: Option A: Remove PoC from copy categories and setup step auto-satisfaction (Only GRADES, JOB_TITLES, and ROLES are copyable; PoC step 8 remains INCOMPLETE upon creation).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Additional Company with Default Status and Empty Steps (Priority: P1)

As an authenticated Tenant Administrator, I want to create a new legal entity (Company) in the system without copying configurations from an existing company, so that my organization can set up and configure a fresh subsidiary or legal entity from scratch under the same tenant.

**Why this priority**: Core baseline requirement for multi-company support within a single tenant. Without this, no additional company entities can be created or tracked.

**Independent Test**: Can be tested by submitting a valid company creation request with template copying disabled. Verification confirms the company is created in `PENDING` status with 8 setup steps initialized in `INCOMPLETE` status, emitting the `company.created` domain event.

**Acceptance Scenarios**:

1. **Given** an authenticated Tenant Administrator and a unique company code within the tenant
   **When** the administrator submits a company creation request without template copy (`copyFromDefault: false`)
   **Then** a new company record is created in `PENDING` status with `is_template` set to `false`.
2. **Given** a new company is created without template copy
   **When** the initial setup sequence is generated
   **Then** exactly 8 mandatory setup steps are created for the new company, all in `INCOMPLETE` status.
3. **Given** a new company creation transaction commits
   **When** outbox events are examined
   **Then** a `company.created` domain event is scheduled for publishing via the transactional outbox.
4. **Given** a company code that already exists within the same tenant
   **When** the administrator submits a creation request with the duplicate code
   **Then** the request is rejected with a uniqueness conflict error without creating duplicate entities.

---

### User Story 2 - Point-in-Time Snapshot Copy of Local Master Data (Grades and Job Titles) (Priority: P2)

As an authenticated Tenant Administrator, I want to selectively copy master data configurations (such as Grades and Job Titles) from the tenant's Default Company into the new company upon creation, so that I do not have to manually re-enter foundational organizational structures.

**Why this priority**: Significantly reduces administrative setup overhead and error rates when onboarding new entities that share standard organizational hierarchies.

**Independent Test**: Can be tested by creating a company with `copyFromDefault: true` and selecting local categories (`GRADES`, `JOB_TITLES`), verifying that cloned records exist with new IDs under the new company, setup steps for copied categories are marked `COMPLETED` (while Step 8 PoC remains `INCOMPLETE`), and subsequent changes to the source company do not affect the target company.

**Acceptance Scenarios**:

1. **Given** a tenant with an established Default Company containing active Grades and Job Titles
   **When** an administrator creates a new company with `copyFromDefault: true` and categories `['GRADES', 'JOB_TITLES']`
   **Then** point-in-time duplicate active records for Grades and Job Titles are created exclusively under the new company ID.
2. **Given** active Grades and Job Titles are copied into the target company
   **When** setup step status is evaluated
   **Then** setup steps for `GRADE` and `JOB_TITLE` are automatically marked `COMPLETED` with completion metadata recording the copy event, while `POC` (Step 8) remains `INCOMPLETE`.
3. **Given** master data records have been successfully copied to the new company
   **When** an administrator modifies or deletes a master data record in the source Default Company
   **Then** the corresponding copied record in the new company remains unchanged (complete post-copy data isolation).
4. **Given** an administrator attempts to copy from a Default Company when none is configured for the tenant
   **When** the creation request is submitted
   **Then** the request is rejected with an unprocessable entity error explaining that no default company template exists.

---

### User Story 3 - Role Configuration Copy Delegation via Asynchronous Messaging (Priority: P3)

As an authenticated Tenant Administrator, I want the system to request a copy of standard security and administrative roles from the Default Company into the new company, so that role-based access can be pre-seeded in the Authorization domain while tracking setup completion asynchronously.

**Why this priority**: Enables complete end-to-end setup automation across bounded contexts without violating microservice domain boundaries or blocking synchronous API execution.

**Independent Test**: Can be tested by creating a company with `ROLES` in `copyCategories`, verifying the dispatch of `authorization.role-copy.requested` via outbox, and validating that consuming `authorization.role-copy.completed` updates setup step 6 (`ROLE`) to `COMPLETED`.

**Acceptance Scenarios**:

1. **Given** an administrator requests company creation with `ROLES` selected in `copyCategories`
   **When** the company creation transaction commits
   **Then** an `authorization.role-copy.requested` domain event is written to the outbox alongside `company.created`.
2. **Given** the new company's `ROLE` setup step is initially in `INCOMPLETE` status
   **When** an `authorization.role-copy.completed` event is received from the Authorization service
   **Then** the `ROLE` setup step for the target company is transitioned to `COMPLETED` with external batch reference stored.
3. **Given** a duplicate `authorization.role-copy.completed` event message with the same event identifier
   **When** the consumer receives the duplicate message
   **Then** the message is processed idempotently without modifying state or throwing duplicate errors.

---

### Edge Cases

- **Duplicate Company Code**: Attempting to create a company with a code already active or pending in the same tenant must fail with a conflict error.
- **Cross-Tenant Template Isolation**: A tenant administrator must never be able to copy configurations from a company belonging to a different tenant.
- **Job Title Dependency on Missing Departments**: When Job Titles are copied and reference departments not yet created in the new company, the job title's department relationship must remain safely unlinked (`NULL`) until explicit mapping or setup.
- **PoC Setup Step Progression**: PoC records are not copied on company creation; setup step 8 (`POC`) must always be configured manually or via subsequent step actions.
- **Network Retries and Duplicate Requests**: Submitting multiple identical creation requests with the same `Idempotency-Key` header must return the original response without creating duplicate entities or duplicate outbox events.
- **Partial Asynchronous Failure**: If role copying fails in the Authorization service, the core company and local master data remain intact in `PENDING` status, and the `ROLE` setup step remains `INCOMPLETE` for manual resolution or retry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST restrict company creation and management actions to authenticated users with Tenant Administrator privileges.
- **FR-002**: System MUST associate each newly created company exclusively with the authenticated tenant's identifier (`tenant_id`).
- **FR-003**: System MUST enforce case-insensitive uniqueness of `company_code` within the scope of a single tenant.
- **FR-004**: System MUST initialize newly created companies with status `PENDING` and `is_template = false`.
- **FR-005**: System MUST validate all company creation input attributes (name, companyCode format, currency, timezone, country).
- **FR-006**: System MUST seed exactly 8 distinct setup steps (`COMPANY_INFORMATION`, `LOCATION`, `DEPARTMENT`, `GRADE`, `JOB_TITLE`, `ROLE`, `EMPLOYEE_IMPORT`, `POC`) for every new company.
- **FR-007**: System MUST support optional point-in-time template copying from the tenant's designated Default Company (`is_template = true`).
- **FR-008**: System MUST support granular category selection for template copying exclusively for `GRADES`, `JOB_TITLES`, and `ROLES`.
- **FR-009**: System MUST perform a deep snapshot copy of selected local master data (Grades, Job Titles) within the same database transaction as the company creation, and MUST NOT copy PoC/Organization Responsibility records during company creation.
- **FR-010**: System MUST ensure complete data isolation for all copied master data records (zero continuous inheritance or cross-company linking).
- **FR-011**: System MUST mark corresponding setup steps (`GRADE`, `JOB_TITLE`) as `COMPLETED` when those categories are copied during creation.
- **FR-012**: System MUST emit a `company.created` domain event via the Transactional Outbox pattern upon successful company creation.
- **FR-013**: System MUST emit an `authorization.role-copy.requested` domain event via the Transactional Outbox pattern when the `ROLES` category is selected for copying.
- **FR-014**: System MUST consume `authorization.role-copy.completed` events asynchronously and mark the `ROLE` setup step as `COMPLETED` in an idempotent manner.
- **FR-015**: System MUST support idempotency keys on company creation requests to prevent duplicate resource creation on network retries.

### Key Entities *(include if feature involves data)*

- **Company**: Represents an independent legal entity under a tenant. Key attributes include `id`, `tenant_id`, `company_code`, `name`, `status` (`PENDING`, `ACTIVE`), `currency`, `timezone`, `country`, and `is_template`.
- **Company Setup Step**: Tracks the provisioning progress of a company across the 8 mandatory stages. Key attributes include `id`, `tenant_id`, `company_id`, `step_type`, `status` (`INCOMPLETE`, `COMPLETED`), `completed_at`, `external_reference_id`, and `metadata`.
- **Grade**: Job grade / level hierarchy entity owned by Setting Service, scoped by `tenant_id` and `company_id`.
- **Job Title**: Master job title entity owned by Setting Service, scoped by `tenant_id` and `company_id`, with optional association to Grade and Department.
- **Point of Contact (PoC)**: Organization responsibility entity owned by Setting Service, scoped by `tenant_id` and `company_id`.
- **Outbox Event**: Transactional outbox log capturing pending domain events for reliable asynchronous publication to Kafka.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Company creation with snapshot master data copy completes in a single synchronous API call in under 1.5 seconds.
- **SC-002**: 100% of copied master data records maintain complete isolation from source templates, with zero mutation leaks on source updates.
- **SC-003**: 100% of newly created companies are initialized with all 8 mandatory setup steps correctly seeded according to template selections.
- **SC-004**: 100% of domain events (`company.created`, `authorization.role-copy.requested`) are committed atomically with the company entity via Transactional Outbox.
- **SC-005**: 100% of duplicate creation attempts (matching tenant + company code or identical idempotency key) are safely detected and rejected without data corruption.

## Assumptions

- Each tenant that enables template copying has at least one active company designated as `is_template = true` (Default Company).
- Role definitions and permissions are exclusively owned and managed by the Authorization microservice; the Setting Service only delegates role copy requests and tracks step completion.
- Department copying is out of scope for initial template copy; Job Titles referencing uncopied departments will leave the department relation unassigned (`NULL`) until configured.
- Point of Contact (PoC) and Employee assignments are configured in subsequent setup steps and not copied during initial company creation.
