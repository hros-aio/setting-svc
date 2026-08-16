# Technical Research & Architectural Decisions: Department Management

**Feature**: Department Management  
**Branch**: `009-department-management`  
**Date**: 2026-08-16  
**Status**: Completed  

---

## 1. Hierarchy Validation & Cycle Prevention

### Decision
Implement multi-layer hierarchy integrity guards:
1. **Self-Parent Guard**: PostgreSQL database check constraint `ck_departments_not_self_parent` (`parent_department_id IS NULL OR parent_department_id <> id`) combined with service-level precondition validation.
2. **Same-Company & Active Parent Guard**: When a `parentDepartmentId` is provided during creation or update, the service validates that the parent exists, is scoped to the identical `tenantId` and `companyId`, and is currently in `active` status.
3. **Anti-Cycle Ancestor Traversal**: When updating `parentDepartmentId` on an existing department, the repository traverses the ancestor chain of the proposed parent using iterative or recursive traversal (bounded by a maximum depth of 50). If the target department's ID appears anywhere in the ancestor chain (e.g., A $\to$ B $\to$ A or A $\to$ B $\to$ C $\to$ A), the request is rejected with a domain conflict error (`409 Conflict` / `CircularHierarchyException`).

### Rationale
- Prevents tree corruption and infinite recursion in downstream organizational hierarchy rendering.
- Bounded depth (50 levels) ensures deterministic, low-latency queries while supporting even the deepest enterprise organizational hierarchies.
- Combining database constraints with domain-level ancestor traversal offers defense-in-depth against concurrent updates and malformed payloads.

### Alternatives Considered
- *In-memory full graph loading*: Fetching the entire company department tree into memory to build an adjacency graph for cycle checks. Rejected because memory overhead scales poorly with large organizations and introduces concurrency race conditions between in-memory caches and DB writes.
- *Database recursive trigger*: Running recursive PL/pgSQL triggers on insert/update. Rejected because it complicates cross-database portability, testing, and migration rollbacks.

---

## 2. Effective-Dated Lifecycle & Outbox Coordination

### Decision
Adopt the dual-mode effective dating pattern established across the HRMS Setting Service:
- **CREATE**: New departments are persisted in `departments` with `status = 'scheduled'` and `effective_at = effectiveAt`. An outbox event (`setting.effective-change.scheduled`) is written in the same transaction for consumption by the Go Worker.
- **UPDATE**: The active `departments` row remains untouched. Modifications are stored in `effective_changes` (`status = 'scheduled'`, `change_type = 'UPDATE'`, `expected_updated_at = department.updated_at`).
- **DEACTIVATE**: The active `departments` row remains `active`. A pending record in `effective_changes` is created (`status = 'scheduled'`, `change_type = 'DEACTIVATE'`).
- **EXECUTION**: When `setting.effective-change.execute` arrives from the Go Worker, `DepartmentApplyHandler` runs inside a single PostgreSQL transaction:
  - For CREATE: transitions `departments.status` from `scheduled` to `active`, updates `updated_at`, and stages `setting.department.created` to `outbox_events`.
  - For UPDATE: verifies optimistic lock (`updated_at === expected_updated_at`), applies payload mutations, marks `effective_changes.status = 'applied'`, and stages `setting.department.updated`.
  - For DEACTIVATE: sets `departments.status = 'inactive'`, marks `effective_changes.status = 'applied'`, and stages `setting.department.deactivated`.

### Rationale
- Completely preserves historical and active state integrity without hard deletes.
- Ensures absolute transactional atomicity between master data mutation, effective change lifecycle tracking, and downstream event emission.
- Go Worker scheduling coordinates through Kafka without direct DB connections (zero shared database access).

### Alternatives Considered
- *Direct cron polling in Setting Service*: Using a local cron job in NestJS to scan for effective dates. Rejected because it cannot coordinate distributed instances, causes DB contention, and violates the polyrepo scheduling architecture (§4, Principle II).
- *In-place overwriting on update*: Overwriting the active department row immediately with future effective dates. Rejected because it leaks unapplied future state into active operational queries.

---

## 3. Single Pending Change Governance (BR-13 / INV-007)

### Decision
Enforce that at most one unexecuted pending change (`status = 'scheduled'`) may exist for a single department at any time:
1. **Application Pre-check**: `DepartmentService` checks `EffectiveChangeRepository.findPendingChangeByEntity(tenantId, companyId, 'DEPARTMENT', departmentId)`. If a record exists, the update/deactivation is rejected with HTTP 409 Conflict.
2. **Database Constraint**: Partial unique index `uq_effective_changes_one_pending_per_entity` on `(tenant_id, company_id, entity_type, entity_id)` WHERE `status = 'scheduled'` acts as the ultimate concurrency safety net.

### Rationale
- Eliminates non-deterministic ordering or cascading conflicts across multiple scheduled future mutations.
- Adheres to core HRMS platform invariant BR-13 and architectural guardrails §24.

---

## 4. Company Setup Step Signaling

### Decision
When creating/scheduling the first department for a company:
- `DepartmentService` queries if any department already exists in `active` or `scheduled` status for the company.
- Invokes `CompanySetupStepRepository.markStepCompleted(tenantId, companyId, SetupStepType.DEPARTMENT, userId, manager)` inside the creation transaction.

### Rationale
- Seamlessly advances the 8-step company onboarding wizard to ensure company activation readiness.
- Transactional coupling guarantees that step completion and department scheduling cannot diverge.

---

## 5. Idempotency & Replay Protection

### Decision
1. **L2 Cache Deduplication**: `EffectiveChangeConsumer` checks Redis key `setting:dedup:{eventId}` with TTL of 86,400s (24 hours).
2. **Domain State Idempotency**: `DepartmentApplyHandler` checks if target department is already `active` (for create) or if `effective_changes` is already `applied`/`cancelled`. If so, it logs an idempotent no-op and acknowledges the event.

### Rationale
- Guarantees exactly-once side effects even under at-least-once Kafka message delivery semantics.
