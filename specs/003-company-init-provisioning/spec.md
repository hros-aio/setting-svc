# Feature Specification: Company Initialization at Tenant Provisioning

**Feature Branch**: `003-company-init-provisioning`

**Created**: 2026-08-15

**Status**: Ready for Implementation

**Input**: User description: "Backend Task Breakdown: Company Initialization at Tenant Provisioning: Automatically provision exactly one initial legal entity (Company) in PENDING status for every newly provisioned Tenant, pre-populate its profile with registration metadata, and seed the 8 mandatory setup steps required for operational governance without requiring manual bootstrap steps."

## Clarifications

### Session 2026-08-15
- Q: Kafka topic, event type, and payload alignment with auth-svc → A: Subscribe to `tenant.lifecycle-events`, filter on `tenant.created` (with `tenant.provisioned` alias for backward compatibility), and extract tenant/company registration metadata matching `@new-hros/libs-events` standards.
- Q: Simplified provisioning idempotency, template flag, and company code generation → A: Use `is_template = true` for the initial default company, check `(tenantId, isTemplate: true)` to guarantee idempotency and avoid separate `consumed_events` entities, and auto-generate `companyCode` from `tenantCode`.
- Q: Transactional Outbox retention → A: Retain `outbox_events` table and outbox event creation (`company.created`) in the same database transaction per Constitution Principle II and System Architecture §7 to avoid dual-write risks and enable asynchronous outbox publishing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Initial Company Provisioning for New Tenants (Priority: P1)

As an HR/Tenant Administrator onboarding to the platform,
I want my tenant account to automatically have an initial legal entity (Company) created in `PENDING` status with `is_template = true` and my organization's basic details pre-filled,
So that I can immediately begin company configuration without manual bootstrap actions or errors.

**Why this priority**:
This is the foundational entry point for any newly provisioned tenant. Without the automated creation of the initial company and tenant projection, no subsequent settings or onboarding steps can proceed.

**Independent Test**:
Can be fully tested by simulating/emitting a `tenant.created` event on topic `tenant.lifecycle-events` for a new tenant and verifying that exactly one company record in `PENDING` status with `is_template = true` is created with auto-generated company code and linked to the tenant projection.

**Acceptance Scenarios**:

1. **Given** a new tenant is provisioned with valid organization registration metadata (name, legal name, currency, timezone, country),
   **When** the system consumes the `tenant.created` (or `tenant.provisioned`) event from topic `tenant.lifecycle-events`,
   **Then** a local tenant reference is established, a single company is created with status `PENDING`, `is_template = true`, auto-generated company code, pre-populated registration details, and exactly 8 mandatory setup steps seeded in `INCOMPLETE` status within an atomic transaction.
2. **Given** a tenant provisioning notification is received,
   **When** company creation succeeds,
   **Then** a `company.created` domain event is reliably queued in the Transactional Outbox for downstream notification/integration.

---

### User Story 2 - Mandatory 8-Step Setup Seeding for Governance (Priority: P1)

As a Compliance Officer and System Administrator,
I want newly created companies to be initialized with 8 mandatory setup steps in fixed sequence and `INCOMPLETE` status,
So that the organization cannot be activated prematurely before fulfilling all statutory and operational requirements.

**Why this priority**:
Governance and platform integrity require that every company adheres to the strict 8-step initialization baseline before becoming operational.

**Independent Test**:
Can be tested by verifying that for any initialized company, exactly 8 step records exist with sequential order (1 to 8) and status `INCOMPLETE`.

**Acceptance Scenarios**:

1. **Given** an initial company is being created during tenant provisioning,
   **When** the setup step seeder executes,
   **Then** exactly 8 distinct setup steps are created in `INCOMPLETE` status with step orders 1 through 8 corresponding to:
     1. `COMPANY_INFORMATION`
     2. `LOCATION`
     3. `DEPARTMENT`
     4. `GRADE`
     5. `JOB_TITLE`
     6. `ROLE`
     7. `EMPLOYEE_IMPORT`
     8. `POC`
2. **Given** an attempt to initialize duplicate step types for the same company,
   **When** setup step creation occurs,
   **Then** the operation is rejected to prevent duplicate configuration milestones.

---

### User Story 3 - Idempotent and Resilient Provisioning Processing (Priority: P2)

As a System Operator,
I want duplicate or re-delivered tenant provisioning events to be handled idempotently,
So that network retries or message redeliveries do not corrupt company state, create duplicate entities, or leave orphaned data.

**Why this priority**:
In distributed microservice environments, duplicate event delivery and transient network issues are normal; the system must guarantee safety and idempotency.

**Independent Test**:
Can be tested by sending the same `tenant.created` event multiple times and verifying that only one default template company and one set of setup steps are created, while subsequent events exit gracefully without error.

**Acceptance Scenarios**:

1. **Given** a tenant provisioning event that has already been processed for a tenant,
   **When** the same event is received again,
   **Then** the system detects the existing default template company for the tenant (`is_template = true`), avoids duplicate creation, and gracefully acknowledges completion.
2. **Given** an error occurs during step seeding or company creation,
   **When** the transaction encounters a failure,
   **Then** the entire provisioning transaction is rolled back, leaving no orphaned company or incomplete step records.

---

### Edge Cases

- **Duplicate Event Delivery**: When a tenant provisioning event is delivered more than once, checking if a template company already exists for the tenant prevents double initialization.
- **Partial Failure During Seeding**: If an unexpected database failure occurs while inserting any setup step, the atomic transaction must rollback all prior writes (company, steps, projection) so the operation can be safely retried.
- **Missing or Null Optional Registration Fields**: If certain optional registration fields (e.g., tax ID) are omitted in the upstream payload, the system falls back to safe null/default values without blocking company creation.
- **Malformed Payload or Unknown Event Type**: If an unparseable event or an unhandled lifecycle event is received on `tenant.lifecycle-events`, the consumer ignores non-matching event types gracefully and routes errors without crashing the service.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST subscribe to Kafka topic `tenant.lifecycle-events` and process `tenant.created` events (supporting `tenant.provisioned` as a backward-compatible alias).
- **FR-002**: System MUST record and maintain a local projection of tenant references containing tenant identifier, code, name, and status.
- **FR-003**: System MUST automatically initialize exactly one initial legal entity (`Company`) upon processing the tenant created event.
- **FR-004**: System MUST initialize the initial company record with status `PENDING` and `is_template = true` (serving as the tenant's primary default template company). Under no circumstances may an initial company be initialized directly to `ACTIVE`.
- **FR-005**: System MUST auto-generate the `company_code` from the tenant code / registration details.
- **FR-006**: System MUST populate the company's profile using registration data from the tenant event payload (including company name, legal name, currency, timezone, and country).
- **FR-007**: System MUST enforce that each company belongs exclusively to one tenant and enforce that at most one template company exists per tenant (`uq_companies_one_template_per_tenant`).
- **FR-008**: System MUST initialize exactly 8 mandatory setup steps for the newly created company, each assigned status `INCOMPLETE`, with orders 1 through 8 corresponding to:
  1. `COMPANY_INFORMATION`
  2. `LOCATION`
  3. `DEPARTMENT`
  4. `GRADE`
  5. `JOB_TITLE`
  6. `ROLE`
  7. `EMPLOYEE_IMPORT`
  8. `POC`
- **FR-009**: System MUST execute tenant reference recording, company creation, setup step seeding, and outbox event emission within an atomic transaction.
- **FR-010**: System MUST emit a `company.created` event via the Transactional Outbox table (`outbox_events`) upon successful company initialization.
- **FR-011**: System MUST support idempotent processing of tenant provisioning events by checking for an existing template company for the tenant (`tenant_id`, `is_template = true`).
- **FR-012**: System MUST reject duplicate setup step types for the same company at the data persistence level.

### Key Entities *(include if feature involves data)*

- **Tenant (Projection)**: Read-only local representation of the upstream tenant; key attributes include `id`, `tenant_code`, `name`, `status`, and timestamps.
- **Company**: Legal entity owned by a tenant; key attributes include `id`, `tenant_id`, `company_code`, `name`, `legal_name`, `tax_id`, `currency`, `timezone`, `country`, `status` (`PENDING`, `ACTIVE`), `is_template`, and audit timestamps.
- **Company Setup Step**: Specific setup milestone required for company activation; key attributes include `id`, `tenant_id`, `company_id`, `step_type` (Enum of 8 steps), `step_order` (1–8), `status` (`INCOMPLETE`, `COMPLETED`), `completed_at`, `completed_by`, `external_reference_id`, and `metadata`.
- **Outbox Event**: Transactional event record storing events such as `company.created` for reliable asynchronous delivery by the outbox publisher.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid `tenant.created` events received on `tenant.lifecycle-events` result in exactly one initial template company (`is_template = true`) in `PENDING` status and all 8 setup steps in `INCOMPLETE` status.
- **SC-002**: Zero duplicate company records or duplicate setup step entries created across duplicate event re-deliveries.
- **SC-003**: 100% transactional consistency: zero orphaned companies created if any sub-step or setup step seeding fails.
- **SC-004**: Provisioning processing completes in under 500 milliseconds from message receipt to transaction commit under normal operational load.

## Assumptions

- Upstream Tenant Service publishes `tenant.created` events on Kafka topic `tenant.lifecycle-events` containing standard `@new-hros/libs-events` envelope metadata and tenant registration details.
- If specific optional legal details (such as tax ID) are omitted in the registration payload, they will default to nullable values to be completed in subsequent setup steps.
- Checking for an existing template company on the tenant (`is_template = true`) provides direct idempotency without requiring auxiliary event tracking tables.
- Transactional Outbox pattern safely decouples database writes from Kafka network availability.
