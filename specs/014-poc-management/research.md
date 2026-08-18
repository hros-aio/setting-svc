# Phase 0 Research: Organization Responsibility (Point of Contact) Management

## 1. PoC Domain Model & Allow-List Governance

### Decision
Model Organization Responsibility (Point of Contact) as a standalone entity (`pocs`) scoped by `tenant_id` and `company_id`, validated against an application-level allow-list of standard responsibility types:
- `COUNTRY_HEAD`
- `HR_HEAD`
- `FINANCE_HEAD`
- `IT_HEAD`
- `PAYROLL_OWNER`

Enforce single active/scheduled holder per responsibility type per company using a PostgreSQL partial unique index:
`uq_pocs_one_active_per_type` on `(company_id, poc_type) WHERE status <> 'inactive'`.

### Rationale
- Decouples organizational leadership and point-of-contact roles from structural hierarchy (Location, Department, Grade, Job Title), adhering to PRD FR-25 and Architecture §14.
- Partial unique index guarantees at the database level that no two active or scheduled holders can exist concurrently for the same `poc_type` within a single company, preventing race conditions.
- Standard allow-list ensures uniform semantics across all multi-tenant companies.

### Alternatives Considered
- *Structural attribute on Employee or Department entity*: Rejected because responsibilities are company-level functional points of contact that change independently of employee job titles or department structures (violates PRD BC-6).
- *Database ENUM for `poc_type`*: Rejected in favor of VARCHAR(64) with application-level validation and TypeScript enum to allow straightforward schema extensibility without DDL locking.

---

## 2. Directory Decoupling & Read-Only Employee Projection

### Decision
Setting Service validates employee eligibility using its local read-only projection table `employee_references` (`tenant_id`, `company_id`, `employee_id`, `employment_status`, `display_name`). Setting Service NEVER performs synchronous HTTP/RPC calls to the Directory domain.

When querying active PoCs, Setting Service joins with `employee_references` to enrich responses with `displayName`, `employeeNumber`, and `employmentStatus`.

If an assigned employee is terminated/inactivated in the Directory service, Setting Service maintains the existing `pocs` assignment record and flags the inactive employee status in query projections rather than silently deleting or deactivating the organizational responsibility.

### Rationale
- Adheres to Polyrepo Architecture & Cross-Service Contracts (Constitution Principle II) and Architecture §1.1 & §14.3.
- Prevents cross-service failure cascading during network outages or Directory service downtime.
- Preserves audit integrity and gives administrators clear operational visibility to designate a successor.

### Alternatives Considered
- *Direct synchronous HTTP call to Directory Service*: Rejected due to latency, coupling, and violation of service autonomy principles.
- *Automatic PoC deactivation on employee termination event*: Rejected per Architecture §14.3; organizational responsibilities must have explicit administrative succession rather than creating sudden silent leadership voids.

---

## 3. Multi-Responsibility & Multi-Company Co-Holding

### Decision
Allow a single `employee_id` to hold multiple distinct responsibility types within the same company (e.g., Jane Doe holding both `FINANCE_HEAD` and `IT_HEAD`) and hold responsibilities across sibling companies within the tenant.

### Rationale
- Fully satisfies PRD BR-24 and Business Spec SET-F012.
- Common organizational pattern in lean operations, subsidiaries, and shared services centers where executive leadership spans multiple functional domains or business entities.

### Alternatives Considered
- *Enforcing unique `(company_id, employee_id)` constraint*: Rejected because it would artificially prevent an executive from holding more than one functional role in a company.

---

## 4. Effective-Dated Lifecycle & Execution Flow

### Decision
All mutations (initial assignment, replacement, deactivation) must provide a future effective date `effective_at` ($\ge$ end of current business day / midnight UTC of next calendar day).
- **Initial Assignment**: Row inserted into `pocs` with `status = 'scheduled'`. Outbox event `setting.effective-change.scheduled` is emitted.
- **Replacement (`UPDATE`)**: Active row remains unchanged; an `effective_changes` record is inserted with `status = 'pending'`, `change_type = 'UPDATE'`, and `payload = { newEmployeeId: '...' }`. Outbox event `setting.effective-change.scheduled` is emitted. Single pending change enforced via `uq_effective_changes_one_pending_per_entity`.
- **Deactivation (`DEACTIVATE`)**: Active row remains unchanged; an `effective_changes` record is inserted with `status = 'pending'`, `change_type = 'DEACTIVATE'`. Outbox event `setting.effective-change.scheduled` is emitted.
- **Scheduled Execution**: When Go Worker triggers `setting.effective-change.execute` via Kafka, `PocApplyHandler` executes within a database transaction:
  - For CREATE: updates `pocs.status` from `scheduled` to `active`, emits `setting.poc.assigned`.
  - For UPDATE: marks previous active `pocs` as `inactive`, creates/activates new `pocs` row, updates `effective_changes.status = 'applied'`, emits `setting.poc.replaced`.
  - For DEACTIVATE: marks `pocs` as `inactive`, updates `effective_changes.status = 'applied'`, emits `setting.poc.deactivated`.

### Rationale
- Conforms to existing effective-dating engine pattern established across Location, Department, Grade, and Job Title modules.
- Ensures idempotency: re-running an apply command for an already-applied change safely no-ops without corrupting state.

### Alternatives Considered
- *Immediate in-place mutation without effective dating*: Rejected as it violates PRD FR-13, BR-10, and BC-2.

---

## 5. Company Setup Step 8 Integration

### Decision
When an Administrator successfully schedules the first Point of Contact assignment for a company, `PocService` invokes `CompanySetupCommandService.markStepComplete({ companyId, tenantId, stepType: SetupStepType.POC })` inside the same database transaction.

### Rationale
- Satisfies PRD FR-16 (Step 8: Organization Responsibility) and Company Setup Tracking requirements.
- Guarantees transactional consistency between PoC creation and setup milestone progression.

### Alternatives Considered
- *Asynchronous event listener for step completion*: Rejected in favor of transactional invocation inside the command boundary to prevent eventual consistency race conditions during company activation checks.
