# Architectural & Implementation Research: Multi-Company Isolation

**Feature**: Multi-Company Isolation  
**Date**: 2026-08-18  
**Status**: Completed  

---

## 1. Database Scoping & Composite Uniqueness Constraints

### Decision
Enforce composite uniqueness constraints scoped to `(company_id, code)` across all organizational master data tables (`locations`, `departments`, `grades`, `job_titles`) and `(company_id, poc_type)` across `pocs`. Ensure all tables contain non-nullable `tenant_id` and `company_id` columns indexed by `(tenant_id, company_id)`.

### Rationale
- Allows sibling companies within the same enterprise tenant to independently reuse business codes (e.g., Grade `L3`, Location `HQ`, Department `ENG`) without database collisions.
- Meets PRD requirements FR-28, FR-29, BR-25, and ADR-11 (Master data is Company-scoped).
- Prevents database-level data corruption and leakage between sibling companies.

### Alternatives Considered
- **Tenant-Wide Uniqueness `(tenant_id, code)`**: Rejected because it prevents legitimate business code reuse across independent legal subsidiaries in a multi-company enterprise.
- **Schema-Per-Company / Schema-Per-Tenant**: Rejected due to high operational complexity, migration overhead, and resource exhaustion in PostgreSQL.

---

## 2. Scoped Repository Layer & Multi-Tenant Query Policy

### Decision
Enforce strict multi-tenant and multi-company query predicates across all repository operations. Every lookup, find, update, and delete operation on company-owned master data must require `tenantId` and `companyId` context parameters extracted from `RequestContextService` or verified `AuthContext`. Bare queries (e.g., `findById(id)`) without `company_id` filters are prohibited for company-scoped entities.

### Rationale
- Guarantees zero cross-company data leakage even when a malicious or confused client supplies an entity ID belonging to a sibling company.
- Ensures effective-dated transitions and setup step tracking execute strictly within the target company boundary.
- Aligns with Constitution Principle I (Layering) and Principle VI (Security & Tenant Isolation).

### Alternatives Considered
- **ORM Global Scope Filters**: Rejected in favor of explicit, strongly-typed repository parameters which ensure full query transparency, testability with Testcontainers, and prevent accidental bypass during complex joins.

---

## 3. Cross-Company Relational Invariant Validation in Domain Services

### Decision
Application and domain services (`JobTitleService`, `DepartmentService`, `PocService`) must perform explicit pre-mutation domain invariant checks verifying that all referenced relational entities belong to the exact same `companyId` and `tenantId`.
- **JobTitle**: Validates `department.companyId === RequestContext.companyId` and `grade.companyId === RequestContext.companyId`.
- **Department**: Validates `parentDepartment.companyId === RequestContext.companyId`.
- **PoC**: Validates `employee.tenantId === RequestContext.tenantId`.

### Rationale
- Relational foreign key constraints verify that a referenced row exists, but cannot easily validate multi-table cross-column tenant/company equality in standard SQL without composite foreign keys.
- Domain-level validation provides descriptive, typed domain exceptions (`CrossCompanyReferenceException` / `BadRequestException`) with actionable error messages for API consumers.
- Enforces System Architecture §13.1, §14.5, and Prohibited Designs §30.

### Alternatives Considered
- **Composite Foreign Keys in PostgreSQL (`FOREIGN KEY (company_id, department_id)`)**: Effective at DB layer, but domain-level validation is still mandatory to provide friendly client error responses instead of unhandled 500 database foreign key violation errors.

---

## 4. Authorization and Scope Guard Integration

### Decision
Apply `TenantScopeGuard` and `CompanyScopeGuard` across all company-scoped NestJS controllers.
- Guards extract and verify `tenantId` and `companyId` from JWT/AuthContext.
- Verify that `path.params.companyId` matches the authorized company claims in the caller's session token.
- Reject mismatched scopes with HTTP 403 Forbidden or HTTP 404 Not Found at the transport boundary before calling domain services.

### Rationale
- Fail-fast protection at the controller/transport layer (Principle I & VI).
- Eliminates reliance on untrusted client request body payloads for company identification.

### Alternatives Considered
- **Validating scope inside each service method**: Rejected because transport security and authorization parameter matching belong at the guard/middleware layer.

---

## 5. Kafka Event Partitioning and Asynchronous Isolation

### Decision
Configure outbox event serialization and Kafka publishers to format partition keys as `${tenantId}:${companyId}` for all company-scoped master data and effective-dating events (`setting.master-data.events`, `setting.effective-change.scheduled`, `setting.effective-change.execute`).

### Rationale
- Guarantees strictly isolated, ordered async event consumption per company.
- High event volume, worker failures, or processing backlogs in Company A cannot serialize or block asynchronous event streams in Company B (System Architecture §6.2, §6.3, ADR-9).

### Alternatives Considered
- **Tenant-Only Partition Keys `${tenantId}`**: Rejected because all companies in a tenant would share a single partition, introducing cross-company head-of-line blocking.
