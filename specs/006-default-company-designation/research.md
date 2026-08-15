# Phase 0 Research: Default Company Designation Technical Decisions

## Decision 1: Atomic Designation Transfer & Single Transactional Boundary

- **Decision**: Encapsulate the default company transfer workflow—clearing `is_template = false` from the current source default company and setting `is_template = true` on the target company—within a single PostgreSQL database transaction using `TransactionService.runInTransaction` (or explicit `EntityManager`).
- **Rationale**: Guarantees that at no point in time does a tenant have multiple default companies or zero default companies. If any update fails, all changes are rolled back completely.
- **Alternatives Considered**:
  - *Two separate API calls or transactions (one to unset old template, one to set new)*: Rejected because a client failure or crash between transactions could leave the tenant with an inconsistent state without completing the assignment.

---

## Decision 2: No Asynchronous Domain Event Publishing

- **Decision**: Default company designation is an internal configuration template marker for Setting Service; do NOT publish asynchronous outbox events or Kafka messages upon transfer.
- **Rationale**: User explicitly clarified that default company conversion is strictly an internal setting update and downstream event dissemination is not required.
- **Alternatives Considered**:
  - *Publishing `company.template-designated` to Kafka*: Rejected per user clarification.

---

## Decision 3: Schema Uniqueness Enforcement & Race Condition Handling

- **Decision**: Enforce at most one template company per tenant at the database schema level using partial unique index `uq_companies_one_template_per_tenant` on `companies(tenant_id) WHERE is_template = true;` and mirror it on the TypeORM entity with `@Index('uq_companies_one_template_per_tenant', ['tenantId'], { unique: true, where: 'is_template = true' })`.
- **Rationale**: Guarantees invariant integrity during concurrent administration requests.

---

## Decision 4: Idempotent Re-Designation Behavior

- **Decision**: If the target company is already the default company (`is_template === true`), the operation succeeds idempotently and returns the company representation with HTTP 200 OK without making redundant database updates.
- **Rationale**: Safe against network retries and duplicate user clicks.

---

## Decision 5: Company Lifecycle Status Restrictions

- **Decision**: Permit designation of both `PENDING` and `ACTIVE` companies within the tenant as the default company template.
- **Rationale**: Complies with PRD FR-7 and SET-F004 specifications where an organization may transfer default template structures to a company regardless of whether it is pending activation.
