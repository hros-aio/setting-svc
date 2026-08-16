# Feature Specification: Location Management

**Feature Branch**: `008-location-management`

**Created**: 2026-08-16

**Status**: Ready for Planning

**Input**: User description: "Backend Task Breakdown: Location Management - Enable Administrators to define, update, and deactivate physical/administrative work locations and headquarter designations scoped strictly to a single Company with mandatory future effective dating (>= end of current business day), preserving active and historical integrity without hard deletes."

## Clarifications

### Session 2026-08-16
- Q: When updating a location from API with a future effective date, should the DB record be updated immediately or deferred until the effective date arrives? → A: Update immediately in DB: Modify the `locations` table record immediately upon API request, but defer publishing the external domain event until `schedule-worker` triggers `effective-change.consumer`.
- Q: How should location creation and deactivation state lifecycles behave relative to effective dates? → A: Hybrid lifecycle: Update modifies fields immediately in DB; Creation remains `scheduled` until effective date; Deactivation remains `active` until effective date when `effective-change.consumer` sets status to `inactive` and publishes to Kafka.
- Q: What should the HTTP response return when an administrator calls `PATCH /locations/:id`? → A: Return updated Location: `PATCH /locations/:id` returns `LocationEntity` (the updated location record), matching `POST /locations`.
- Q: How should `effective-change.consumer` handle scheduled UPDATE execution on the effective date? → A: Publish event & mark applied: `effective-change.consumer` publishes `setting.location.updated` to Kafka and marks the `EffectiveChange` record as `applied`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Schedule a Work Location (Priority: P1)

As a Company Administrator, I want to create a new physical or administrative location for my company and schedule it for a future effective date, so that future organizational site changes are planned ahead of time and satisfy company onboarding requirements.

**Why this priority**: Core foundational capability needed to establish company workplaces and satisfy the Location setup step during company onboarding.

**Independent Test**: Can be tested independently by submitting a valid location creation request with a future effective date and verifying the record is scheduled, visible in the system, and advances company setup readiness.

**Acceptance Scenarios**:

1. **Given** an Administrator scoped to a Company, **When** they create a new location with a code, name, country code, timezone, and an effective date scheduled at or after the end of the current business day in the company's timezone, **Then** the location is stored in `scheduled` status with the target effective date.
2. **Given** a Company undergoing initial setup with incomplete steps, **When** the first location is created and scheduled, **Then** the `LOCATION` setup step for that Company is marked as completed.
3. **Given** a creation request with an effective date earlier than the end of the current business day in the Company's timezone, **When** submitted, **Then** the system rejects the request with a validation error indicating future effective dating rules.
4. **Given** an existing active or scheduled headquarter location for a Company, **When** an Administrator attempts to create another location designated as headquarter, **Then** the system rejects the request with a clear business conflict error indicating that only one headquarter is permitted per Company.

---

### User Story 2 - Query Active and Historical Locations with Multi-Company Isolation (Priority: P1)

As an HR Business User or Administrator, I want to view the list of currently active locations as well as inspect specific historical or inactive locations within my assigned Company, so that daily HR operations and audits have accurate site information without cross-company data leakage.

**Why this priority**: Essential operational read capability required by downstream modules, employee assignments, and administrative visibility.

**Independent Test**: Can be tested independently by querying active location lists and direct location details using authorized credentials across multiple distinct companies.

**Acceptance Scenarios**:

1. **Given** an authenticated user scoped to Company A, **When** they request the list of active locations, **Then** only locations belonging to Company A with `active` status are returned (excluding `scheduled` and `inactive` locations).
2. **Given** an inactive or historical location in Company A, **When** an Administrator queries that specific location by ID within Company A, **Then** the full details and historical status are returned for audit reference.
3. **Given** a user scoped to Company A, **When** they attempt to list or access locations belonging to Company B, **Then** the system denies access or returns a not-found response ensuring strict tenant and company isolation.

---

### User Story 3 - Update Location with Scheduled Effective Event (Priority: P2)

As a Company Administrator, I want to update an existing active location (such as name, address, timezone, or headquarter status) with a future effective date, so that the location record in DB is immediately updated while domain event publication to downstream services is scheduled for the effective date.

**Why this priority**: Allows ongoing operational maintenance of active locations while orchestrating future domain event synchronization.

**Independent Test**: Can be tested independently by updating an active location and verifying that the DB record updates immediately, a pending effective change tracking record is saved, and outbox event for schedule-worker is emitted.

**Acceptance Scenarios**:

1. **Given** an active location with no pending changes, **When** an Administrator updates location fields with a valid future effective date ($\ge$ end of current business day), **Then** the `locations` table record is updated immediately in DB, and a scheduled change record is created to schedule future domain event emission.
2. **Given** an active location that already has a pending scheduled change, **When** an Administrator attempts to submit another update or deactivation, **Then** the system rejects the request with a conflict error enforcing the single-pending-change constraint.
3. **Given** a scheduled update job triggered on its effective date, **When** `effective-change.consumer` receives the execution trigger, **Then** it publishes the `setting.location.updated` domain event to Kafka and marks the change as applied.

---

### User Story 4 - Schedule Location Deactivation (Priority: P2)

As a Company Administrator, I want to schedule the deactivation of an active location for a future date, so that the location remains fully usable until that date and transitions to inactive automatically without hard deletes.

**Why this priority**: Required for retiring offices or facilities without breaking historical references or creating sudden operational disruptions.

**Independent Test**: Can be tested independently by scheduling deactivation on an active location, verifying it remains active prior to the effective date, and confirming it transitions to inactive upon effective date arrival.

**Acceptance Scenarios**:

1. **Given** an active location, **When** an Administrator schedules deactivation with a valid future effective date, **Then** a pending deactivation change is recorded and the location remains `active` until the effective date.
2. **Given** a scheduled deactivation reaching its effective timestamp, **When** the execution is processed, **Then** the location status transitions from `active` to `inactive`, preserving all historical associations without deleting the database record.

---

### User Story 5 - Automatic Effective Execution and State Transition (Priority: P3)

As the HRMS System, I want scheduled location creations, updates, and deactivations to execute automatically when their effective date and time arrive, so that organizational master data reflects the planned reality seamlessly and notifies downstream domains.

**Why this priority**: Completes the lifecycle of scheduled changes and synchronizes master data across the enterprise platform.

**Independent Test**: Can be tested independently by triggering the execution consumer for scheduled changes and verifying status transitions and domain event publication.

**Acceptance Scenarios**:

1. **Given** a location in `scheduled` status reaching its effective time, **When** the execution trigger is processed, **Then** its status transitions to `active` and a domain notification is emitted.
2. **Given** a scheduled `UPDATE` pending change reaching its effective time with valid precondition state, **When** the execution trigger is processed, **Then** the new fields are applied to the active location, the change is marked as `applied`, and a domain update event is emitted.
3. **Given** a scheduled change that was cancelled by an Administrator prior to its execution date, **When** the execution trigger arrives, **Then** the system detects the cancelled status, aborts modifications safely, and completes processing without errors.

---

### Edge Cases

- **Duplicate Location Code**: Attempting to create a location with a code that already exists within the same Company (case-insensitive or exact match) is rejected with a 409 Conflict.
- **Headquarter Conflict across Active and Scheduled Records**: A company cannot have more than one active headquarter, nor can a new headquarter be scheduled if another active or scheduled headquarter is already designated.
- **End-of-Day Cutoff Edge**: A request submitted with an effective timestamp exactly at or past 23:59:59 in the Company's timezone for today is accepted; anything before today's business day cutoff is rejected.
- **Timezone Fallback**: If a Company has not explicitly configured a timezone, the system defaults to UTC for calculating the end of current business day.
- **Duplicate Execution Signals**: If redundant execution triggers arrive for the same scheduled change, idempotent execution logic must acknowledge the event without applying duplicate mutations or failing.
- **Permanent Inactivity**: Inactive locations cannot be edited or reactivated in v1; direct queries by ID return the inactive record for audit purposes.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow Administrators to create a Location scoped strictly to a single Company with mandatory fields: `code`, `name`, `countryCode`, `timezone`, and `effectiveAt`.
- **FR-002**: System MUST validate that `effectiveAt` for any creation, update, or deactivation is scheduled at or after the end of the current business day in the target Company's configured timezone (or UTC if unconfigured).
- **FR-003**: System MUST persist newly created locations initially in `scheduled` status until their effective date arrives.
- **FR-004**: System MUST automatically mark the `LOCATION` company setup step as `COMPLETED` when the first location is created for a Company.
- **FR-005**: System MUST enforce code uniqueness `(company_id, code)` per Company.
- **FR-006**: System MUST enforce that at most one Location per Company can be designated as `is_headquarter = true` across all non-inactive states.
- **FR-007**: System MUST allow Administrators to update active locations with a future effective date, updating the operational location record immediately in DB while recording an effective change schedule to publish downstream domain events on the effective date.
- **FR-008**: System MUST allow Administrators to schedule deactivation of an active location, retaining its active status until the effective date.
- **FR-009**: System MUST enforce that an active Location can have at most ONE pending scheduled change (`scheduled` status) at any given time, rejecting subsequent change requests with 409 Conflict.
- **FR-010**: System MUST automatically transition scheduled locations from `scheduled` to `active` when the effective execution occurs.
- **FR-011**: System MUST publish domain events (`setting.location.created`, `setting.location.updated`, `setting.location.deactivated`) to Kafka via `effective-change.consumer` when `schedule-worker` execution triggers arrive on the effective date.
- **FR-012**: System MUST transition pending changes to `conflict` status if optimistic locking detects data drift between change scheduling and execution.
- **FR-013**: System MUST provide paginated listing of active Locations filtered strictly by caller's authenticated `tenant_id` and `company_id`.
- **FR-014**: System MUST allow retrieval of single location details (including historical/inactive status) scoped to the caller's Company for audit and reference.
- **FR-015**: System MUST publish domain events (`setting.location.created`, `setting.location.updated`, `setting.location.deactivated`) via Transactional Outbox upon state transition execution.
- **FR-016**: System MUST reject any attempts to hard delete location records, preserving historical audit integrity.

---

### Key Entities *(include if feature involves data)*

- **Location**: Represents a physical or administrative work facility owned by a specific Company.
  - Key attributes: `id`, `tenant_id`, `company_id`, `code`, `name`, `description`, `country_code`, `timezone`, `address` (structured JSON), `status` (`scheduled`, `active`, `inactive`), `effective_at`, `is_headquarter`, `created_at`, `updated_at`, `deleted_at`.
- **Effective Change**: Represents a scheduled state mutation (CREATE, UPDATE, DEACTIVATE) awaiting future execution.
  - Key attributes: `id`, `tenant_id`, `company_id`, `entity_type` (`LOCATION`), `entity_id`, `operation`, `effective_at`, `payload` (JSON), `expected_updated_at`, `status` (`scheduled`, `applied`, `cancelled`, `conflict`), `applied_at`, `created_at`.
- **Company Setup Step**: Tracks the onboarding readiness for a Company.
  - Key attributes: `company_id`, `step_type` (`LOCATION`), `status` (`PENDING`, `COMPLETED`).
- **Outbox Event**: Transactionally persisted event record for reliable asynchronous messaging and scheduling.
  - Key attributes: `id`, `topic`, `partition_key`, `payload`, `status`, `created_at`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Location records are strictly isolated by `tenant_id` and `company_id`, with 0 cross-company data leakage across queries and commands.
- **SC-002**: 100% of location write operations enforce future effective dating ($\ge$ end of current business day in company timezone), rejecting past or immediate same-day mutations.
- **SC-003**: 100% of location state transitions (creation, update, deactivation) execute idempotently without data loss or duplicate application upon receiving execution triggers.
- **SC-004**: 0% accidental loss of historical records; no physical delete operations occur on location tables.
- **SC-005**: Query latency for active locations returns in under 100ms for standard paginated requests.
- **SC-006**: Company setup step `LOCATION` reliably transitions to `COMPLETED` immediately upon initial location creation in 100% of onboarding test scenarios.

---

## Assumptions

- **Timezone Resolution**: The Company's configured timezone in `companies.timezone` is the authority for computing "end of current business day"; if unset or null, UTC is used as the system fallback.
- **Single Pending Change Rule**: An active location can have only one pending scheduled change at any time. If an administrator needs to alter a pending change, the existing change must be cancelled before a new one can be scheduled.
- **Permanent Inactivity in v1**: Reactivation of inactive locations is out of scope for v1 (following business question BQ-001); once a location transitions to `inactive`, it remains read-only for historical and audit purposes.
- **Transactional Outbox & Worker Integration**: The Setting Service is the exclusive domain authority and database owner; external execution workers communicate exclusively via Kafka event contracts without direct database access.
- **Authorization Context**: Authentication and authorization context (`tenant_id`, `company_id`, user permissions) are provided reliably via `@hros/libs-apis` guards and `RequestContext`.
