# Research: Domain & Technical Decisions for Setting Service Initial Model & Schema

## 1. Domain Modeling & Aggregate Boundary Resolutions

### Aggregate Root Boundaries
- **Decision**: Define `Company`, `Location`, `Department`, `Grade`, `JobTitle`, `Point of Contact (PoC)`, and `Effective Change` as separate Aggregate Roots. `Company Setup Step` is a child entity under the `Company` Aggregate Root.
- **Rationale**: Although database tables feature `ON DELETE CASCADE` from `companies`, master data entities (`Location`, `Department`, `Grade`, `JobTitle`, `PoC`) possess distinct identities, business codes, individual status lifecycles (`scheduled`/`active`/`inactive`), and effective-date schedules. Modifying a Location or Department does not alter the Company state.
- **Alternatives Considered**:
  - *Single Large Company Aggregate*: Making all organizational units children of Company. Rejected due to extreme transactional contention, massive memory load, and poor domain isolation.

---

## 2. Multi-Tenancy & Security Rules

### Tenant & Company Scoping Isolation
- **Decision**: Every query and database operation across all tables MUST explicitly enforce `tenant_id` scoping. Company-scoped entities (`locations`, `departments`, `grades`, `job_titles`, `pocs`, `effective_changes`) MUST also enforce `company_id` equality.
- **Rationale**: Enterprise HRMS multi-tenant security requirements mandate strict tenant boundary guarantees. No tenant or company can inspect or mutate another tenant's or company's data.
- **Cross-Boundary Domain Validations**:
  - For `Department` parent references (`parent_department_id`): Domain logic must assert `parent.tenant_id == child.tenant_id` AND `parent.company_id == child.company_id`.
  - For `JobTitle` linkages (`department_id`, `grade_id`): Domain logic must assert `department.company_id == grade.company_id == job_title.company_id`.

---

## 3. Effective-Date Processing & Change Management

### Effective Changes Execution Mechanics
- **Decision**: 
  - Direct creation (`CREATE`): Master entity row inserted directly with `status = 'scheduled'` and `effective_at = <future_timestamp>`. Transitioned to `active` at execution time.
  - Future updates/deactivations (`UPDATE`/`DEACTIVATE`): Current row remains untouched in its current state (`active`). An `effective_changes` record is created storing `payload` (JSONB) and `expected_updated_at`.
  - Single Pending Limit: The partial unique index `uq_effective_changes_one_pending_per_entity` enforces at most ONE pending (`scheduled` or `processing`) change per target entity.
- **Rationale**: Aligns strictly with `schema.sql` capabilities and avoids introducing un-indexed temporal tables or unsupported multi-version queues.

---

## 4. Integration Events & Domain Messaging

### Asynchronous Cross-Service Synchronization
- **Decision**: Setting Service acts as the authoritative source of truth for organizational master data. All state mutations (`company.activated`, `location.created`, `location.updated`, `department.created`, `department.updated`, etc.) produce domain event payloads via the Transactional Outbox pattern for asynchronous consumption by Directory, Payroll, and Attendance services.
- **Rationale**: Maintains polyrepo boundaries and prevents tight synchronous runtime coupling across microservices.
