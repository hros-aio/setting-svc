# Research & Architectural Decisions: Employee Transfer Between Companies

**Feature**: Employee Transfer Between Companies  
**Branch**: `016-employee-transfer`  
**Date**: 2026-08-19

## Technical Decisions & Rationale

### Decision 1: Dedicated Persistence Layer with Database-Level Partial Unique Constraint

- **Decision**: Introduce a dedicated `EmployeeTransferEntity` mapped to the `employee_transfers` table, accompanied by a PostgreSQL partial unique index `uq_employee_pending_transfer` on `(tenant_id, employee_id) WHERE status = 'PENDING'`.
- **Rationale**:
  - Business rules (BR-33 / INV-007) mandate that an employee can have at most one pending inter-company transfer at any given time.
  - Relying solely on application-level checks exposes the system to race conditions under concurrent administrator submissions. A database-level partial unique index provides foolproof consistency without blocking future or past completed transfers.
  - The entity cleanly tracks transfer lifecycle attributes: `tenant_id`, `employee_id`, `source_company_id`, `destination_company_id`, `destination_location_id`, `destination_department_id`, `destination_grade_id`, `destination_job_title_id`, `effective_at`, and `status` (`PENDING`, `COMPLETED`, `CANCELLED`).
- **Alternatives Considered**:
  - *Storing pending transfer status directly in `employee_references`*: Rejected because it couples master employee projections with ephemeral transfer lifecycle state and loses historical audit trail for multiple historical transfers.
  - *Full table unique constraint on `(tenant_id, employee_id)`*: Rejected because employees must be permitted to have multiple historical completed transfers over their tenure.

---

### Decision 2: Comprehensive Destination Master Data & Company Verification Pipeline

- **Decision**: Implement `ValidateTransferRequestService` (or method within `EmployeeTransferService`) that executes strict multi-entity integrity validations prior to persisting any pending transfer:
  1. Destination Company validation: Must exist within the same tenant and possess `status = 'ACTIVE'` (reject if `PENDING` or inactive).
  2. Employee attribution check: Employee must exist and currently be attributed to `source_company_id`.
  3. Single pending transfer check: No existing `PENDING` transfer in `employee_transfers` for this employee.
  4. Destination master data verification: If provided, `destination_location_id`, `destination_department_id`, `destination_grade_id`, and `destination_job_title_id` must exist, have `status = 'ACTIVE'`, and belong strictly to `destination_company_id`.
  5. Future effective date enforcement: `effectiveAt` must be $\ge$ end of current business day in tenant/company timezone (defaults to 23:59:59.999 UTC if timezone unconfigured).
- **Rationale**:
  - Enforces multi-company isolation invariants (INV-005, INV-006). Master data entities are strictly scoped to individual companies and must never be referenced cross-company.
  - Guarantees fail-fast behavior with descriptive validation errors before any state change or outbox event generation.
- **Alternatives Considered**:
  - *Validating destination master data only at execution time*: Rejected because administrators need immediate feedback when scheduling a transfer with invalid parameters.
  - *Allowing optional master data from source company*: Rejected because organizational structures (Departments, Locations, Grades, Job Titles) are company-scoped.

---

### Decision 3: Atomic Dual-Write via Transactional Outbox for Scheduling

- **Decision**: Wrap the insertion of `employee_transfers` (`status = 'PENDING'`) and staging of the scheduling outbox event (`setting.effective-change.scheduled`) within a single PostgreSQL transaction managed via `DataSource.transaction` or `EntityManager`.
- **Rationale**:
  - Adheres to Constitution Principle II & Principle V (Polyrepo Architecture & Database Integrity).
  - Eliminates dual-write anomalies where a transfer record is saved in the database but the Go worker/scheduler never receives the scheduling event due to network or broker failure.
  - Emits the event with `AggregateType.EMPLOYEE_TRANSFER` (or `AggregateType.EFFECTIVE_CHANGE`) using the standard `@new-hros/libs-events` envelope.
- **Alternatives Considered**:
  - *Direct synchronous HTTP call to external scheduler*: Rejected as it introduces hard runtime coupling, violates microservice independence, and causes partial failure vulnerabilities.

---

### Decision 4: Idempotent Execution Handler & Continuous Employment Transition

- **Decision**: Execute transfers via `ExecuteEmployeeTransferHandler` (integrating with `EffectiveChangeModule` or consumer callback) using a two-tier idempotency strategy:
  1. Redis key deduplication (`SETNX transfer:exec:{transferId}` with 24h TTL) to reject rapid duplicate delivery.
  2. Database transaction check: Load `employee_transfers` row with pessimistic lock or status check (`status === 'PENDING'`). If already `COMPLETED`, log and skip gracefully.
  3. Update `employee_references`: Update `company_id` to `destination_company_id`, update local master data projection, and increment version/timestamp.
  4. Update `employee_transfers.status` to `COMPLETED`.
  5. Stage outbox domain event `employee.company-transferred` (and/or `setting.employee-transfer.events`) containing full transfer metadata for downstream consumers (Access, Time, Payroll).
- **Rationale**:
  - Models continuous employment (BR-31, BC-9, INV-008): preserves historical employment records, seniority dates, and previous company tenures without triggering termination or re-hire workflows.
  - Guarantees exactly-once side effects even under Kafka message replay or concurrent scheduler triggers.
- **Alternatives Considered**:
  - *Triggering termination in source company and re-hiring in destination company*: Strictly prohibited by PRD BR-31 / BC-9 as it breaks continuous service, resets leave balances improperly, and violates labor compliance.

---

### Decision 5: Clean Architecture Module Structure & REST Controller Contracts

- **Decision**: Create a dedicated `EmployeeTransferModule` in `src/modules/employee-transfer/` containing:
  - `controllers/employee-transfer.controller.ts`: Transport layer handling HTTP requests (`POST .../transfers`, `GET .../transfers/pending`, `GET .../transfers/history`), applying `@UseGuards(AuthGuard, PermissionGuard)`.
  - `dtos/initiate-employee-transfer.dto.ts`, `query-employee-transfer.dto.ts`, `employee-transfer-response.dto.ts`: Strict validation using `class-validator` and `class-transformer`.
  - `services/employee-transfer.service.ts`: Core application service orchestrating validation, initiation transactions, outbox emission, and query logic.
  - `repositories/employee-transfer.repository.ts`: Encapsulated TypeORM data access.
  - Integration with `EffectiveChangeModule` via an apply handler `employee-transfer-apply.handler.ts` to execute transfers upon scheduler callbacks.
- **Rationale**:
  - Follows Constitution Principle I (Clean Architecture Layering & Module Boundaries).
  - Module index barrel `src/modules/employee-transfer/index.ts` re-exports public services and entities cleanly.
- **Alternatives Considered**:
  - *Embedding transfer logic inside `EmployeeReferenceModule`*: Rejected because `EmployeeReferenceModule` is a read-only projection/lookup module for employee directory records, whereas transfer is a complex transactional workflow with state machine, outbox events, and master data cross-validation.

---

## Summary of Architectural Invariants

| Invariant | Implementation Mechanism | Enforcement Layer |
|-----------|--------------------------|-------------------|
| **Single Pending Transfer per Employee** (INV-007, BR-33) | `uq_employee_pending_transfer` partial unique index + service check | Database + Service |
| **Mandatory Future Effective Date** (BR-28, FR-31) | `effectiveAt >= endOfCurrentBusinessDay` validator | Service DTO / Domain |
| **Active Destination Company** (BR-SET-F011-04) | Query `CompanyRepository` where `id = destinationCompanyId AND status = 'ACTIVE'` | Service Validation |
| **Destination Master Data Isolation** (INV-005, INV-006) | Validate `company_id = destinationCompanyId AND status = 'ACTIVE'` for Location, Dept, Grade, JobTitle | Service Validation |
| **Atomic Scheduling & Outbox** | PostgreSQL ACID Transaction via `DataSource` / `EntityManager` | Persistence Layer |
| **Continuous Employment** (INV-008, BR-31) | Transition attribution in `employee_references` + publish `employee.company-transferred` without termination event | Domain Handler |
| **Execution Idempotency** | Redis `SETNX` + DB state verification (`status = PENDING`) | Execution Handler |
