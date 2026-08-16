# Technical Research & Architectural Decisions: Grade Management

**Feature**: Grade Management  
**Branch**: `010-grade-management`  
**Date**: 2026-08-16  
**Status**: Completed  

---

## 1. Domain Scoping, Multi-Tenancy & Unique Constraints

### Decision
Enforce strict multi-tenant and multi-company isolation at repository and database layers:
1. **Schema Uniqueness**: Unique constraint `uq_grades_company_code` on `(company_id, code)` ensures Grade codes are unique per Company across all lifecycle statuses (`scheduled`, `active`, `inactive`) while allowing identical codes across different Companies within the same Tenant.
2. **Context Resolution**: All read and write operations strictly resolve `tenantId` and `companyId` from `RequestContext` (`@hros/libs-apis`) and enforce them in TypeORM repository filters.
3. **Template Copy Lineage**: Optional `source_grade_id` foreign key referencing `grades(id)` on `DELETE SET NULL` is maintained for informational copy lineage when initializing a company from templates, with zero ongoing runtime inheritance or coupling.

### Rationale
- Complies with `BR-SET-F007-01` and `INV-005` (Grade belongs exclusively to one Company; code unique per Company).
- Prevents cross-company data leakage or collisions between sibling companies within the same enterprise tenant.

### Alternatives Considered
- *Tenant-wide unique code constraint*: Enforcing code uniqueness across the whole tenant. Rejected because different operating companies within a multi-entity conglomerate often use standard leveling codes (e.g., "L1", "L2", "M1").
- *Soft-deleting and recycling codes*: Allowing deactivated grade codes to be reused. Rejected because historical payroll and compensation records require immutable historical code references.

---

## 2. Effective-Dated Change Architecture & Asynchronous Coordination

### Decision
Follow the established HRMS Setting Service effective-dated state machine:
- **CREATE**: A new Grade record is inserted into `grades` with `status = 'scheduled'` and `effective_at = effectiveAt`. An outbox event targeting `setting.effective-change.scheduled` is staged within the same database transaction.
- **UPDATE**: The active `grades` row remains unmodified in `active` status. An `effective_changes` record is created (`status = 'scheduled'`, `entity_type = 'GRADE'`, `action = 'UPDATE'`, `payload = { name, rankOrder, description }`, `expected_updated_at = grade.updated_at`, `effective_at = effectiveAt`).
- **DEACTIVATE**: The active `grades` row remains in `active` status. An `effective_changes` record is created (`status = 'scheduled'`, `entity_type = 'GRADE'`, `action = 'DEACTIVATE'`, `expected_updated_at = grade.updated_at`, `effective_at = effectiveAt`).
- **EXECUTION**: When `setting.effective-change.execute` arrives from the Go Worker:
  - CREATE: `GradeApplyHandler` transitions `grades.status` from `scheduled` to `active`, updates `updated_at`, and stages `setting.grade.created` in `outbox_events` targeting `setting.master-data.events`.
  - UPDATE: verifies optimistic concurrency (`grade.updated_at === change.expected_updated_at`), applies payload changes (`name`, `rankOrder`, `description`) to `grades`, sets `effective_changes.status = 'applied'`, and stages `setting.grade.updated`.
  - DEACTIVATE: verifies optimistic lock, transitions `grades.status` from `active` to `inactive`, sets `effective_changes.status = 'applied'`, and stages `setting.grade.deactivated`.

### Rationale
- Completely preserves active and historical state integrity without hard deletes.
- Ensures absolute transactional atomicity between master data state mutations, change records, and downstream outbox event publishing.
- The Go Worker scheduler operates with zero direct database connections, preserving polyrepo boundaries and microservice autonomy (ADR-6, ADR-8).

### Alternatives Considered
- *Immediate in-place update with future effective date*: Updating master row directly and relying on application queries to filter based on date. Rejected because it leaks unapplied future state into operational queries and breaks optimistic locking.
- *Synchronous DB write from Go Worker*: Allowing Go Worker to update `grades` table directly. Rejected because it violates domain ownership, polyrepo architecture (Constitution Principle II), and bypasses Setting Service domain validation.

---

## 3. Single Pending Change Governance (BR-13 / INV-007)

### Decision
Enforce that at most one pending scheduled change (`status = 'scheduled'`) may exist for any Grade entity at any given time:
1. **Application Precondition Check**: `GradeService` checks `EffectiveChangeRepository.findPendingChangeByEntity(tenantId, companyId, 'GRADE', gradeId)`. If a scheduled record exists, subsequent update or deactivation requests are rejected with `409 Conflict`.
2. **Database Integrity**: Partial unique index `uq_effective_changes_one_pending_per_entity` on `(tenant_id, company_id, entity_type, entity_id)` WHERE `status = 'scheduled'` ensures concurrency safety at the persistence layer.

### Rationale
- Prevents race conditions, ambiguous effective ordering, and cascading conflicts across multiple scheduled future mutations.
- Adheres to platform invariant `INV-007` and architecture §24.

---

## 4. Company Setup Step 4 Completion Tracking

### Decision
When the first Grade is created/scheduled for a Company:
- `GradeService` checks if any Grade already exists in `scheduled` or `active` status for the company (`GradeRepository.hasActiveOrScheduled`).
- Invokes `CompanySetupStepService.markStepCompleted(tenantId, companyId, SetupStepType.GRADE, userId, entityManager)` within the same database transaction.

### Rationale
- Automatically advances company onboarding Step 4 (`GRADE`) upon initial configuration without requiring separate manual setup signaling.
- Transactional coupling guarantees consistency between setup progress and master data persistence.

---

## 5. Idempotency & Concurrency Safeguards

### Decision
1. **Redis Deduplication**: Incoming Kafka execution messages (`setting.effective-change.execute`) are checked via Redis `SETNX setting:dedup:{eventId} 1 EX 86400` before processing. If key exists, consumer acknowledges message and exits immediately.
2. **Optimistic Locking & State Revalidation**: `GradeApplyHandler` checks whether the target Grade is already `active` (for CREATE) or whether `effective_changes` is already `applied`/`cancelled`. It validates `expected_updated_at` against the current master row timestamp to detect concurrent drift. If drift occurs, the change is transitioned to `conflict` and alerted.

### Rationale
- Guarantees exactly-once side-effect execution under at-least-once Kafka delivery.
- Protects master data from race conditions or stale writes.
