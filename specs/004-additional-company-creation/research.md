# Phase 0 Research: Additional Company Creation Technical Decisions

## Decision 1: Company Creation and Setup Seeding Architecture

- **Decision**: Encapsulate company creation orchestration within `CompanyService` (or command handler) using explicit PostgreSQL transactions via `@hros/libs-sql` `withTransaction(entityManager)`.
- **Rationale**: Company record insertion, template snapshot duplication (Grades, Job Titles, PoCs), setup step sequence seeding (8 records), and outbox event writes (`company.created`, `authorization.role-copy.requested`) must succeed or fail as a single atomic unit of work (ACID).
- **Alternatives Considered**:
  - *Separate endpoint calls / multi-phase REST calls*: Rejected because partial failures would leave orphan companies without setup steps or unsynced outbox events, breaking invariants `INV-001` and `INV-004`.
  - *Database Triggers / Stored Procedures*: Rejected per Constitution Principle I & V; business domain logic and setup orchestration belong in the NestJS application service layer.

---

## Decision 2: Point-in-Time Snapshot Copy Isolation Strategy

- **Decision**: Perform deep clone copies with new UUID primary keys, target `company_id`, and `is_template = false`, while setting `source_<entity>_id` for audit traceability only.
- **Rationale**: Satisfies `INV-003` and `INV-005` (zero continuous inheritance). Copied records are completely detached from the Default Company template. Subsequent updates or deletions to source templates will have zero ripple effect on target companies.
- **Handling Job Title Foreign Keys (Architecture Gap §31)**:
  - When copying `Job Titles`, the new job title references the newly copied `Grade` in the target company.
  - Because `Departments` are not part of the initial template copy category selection, `department_id` is set to `NULL` (or mapped if an identical department code exists) to maintain referential integrity without blocking company creation.
- **Alternatives Considered**:
  - *Shared master data with multi-tenant lookup pointers*: Rejected due to violation of tenant/company data isolation principles and inability of companies to customize grades/job titles independently.

---

## Decision 3: Role Copy Delegation via Transactional Outbox Pattern

- **Decision**: Publish `authorization.role-copy.requested` to Kafka via `outbox_events` table during the company creation transaction. Consume `authorization.role-copy.completed` asynchronously to mark step 6 (`ROLE`) as `COMPLETED`.
- **Rationale**: Setting Service does not own or store Role definitions (Constitution Principle II & Prohibited Designs §30). The Authorization service owns roles. Asynchronous event messaging keeps company creation fast and decoupled.
- **Deduplication & Idempotency**:
  - Consumer uses Redis `SETNX setting:dedup:{eventId} EX 86400` before updating step status.
  - Step update query checks whether step is already `COMPLETED` before mutating timestamps.
- **Alternatives Considered**:
  - *Synchronous HTTP REST call to Authorization Service*: Rejected to avoid distributed transactions, two-phase commits, and HTTP coupling that could cause timeouts or cascading failures during company provisioning.

---

## Decision 4: Idempotency Key Handling for Creation Endpoint

- **Decision**: Use HTTP `Idempotency-Key` header with Redis lock/caching middleware or dedicated repository check to prevent duplicate company creation on client retries (§23).
- **Rationale**: Network retries or rapid double-clicks by administrators must not result in duplicate companies or constraint violation errors.
