# Implementation Plan: Department Management

**Branch**: `009-department-management` | **Date**: 2026-08-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-department-management/spec.md`

## Summary

Implement Department Management within `setting-svc` to allow Administrators to create, update, and deactivate functional organizational units scoped strictly to a single Company. The solution enforces mandatory future effective dating ($\ge$ end of current business day in the Company's timezone), hierarchy integrity (parent validation, self-parent protection, anti-cycle ancestor chain traversal up to depth 50), single pending change constraint (`INV-007`), atomic setup step 3 (`DEPARTMENT`) completion tracking, and outbox event publishing. The state machine transitions via an idempotent Kafka execution consumer (`scheduled` $\to$ `active`, field mutations, and `active` $\to$ `inactive`) with downstream master data event emission and zero hard deletes.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22 LTS / NestJS 10.x  
**Primary Dependencies**: TypeORM, PostgreSQL (`@hros/libs-sql`), NestJS CQRS/Services, Class-Validator / Class-Transformer, Kafka (`@hros/libs-events`, `@nestjs/microservices` / KafkaJS), Redis (`ioredis`, `CacheManager`)  
**Storage**: PostgreSQL 18 (Multi-tenant relational persistence with schema constraints: composite uniqueness `(company_id, code)` on `departments`, check constraint `ck_departments_not_self_parent`, partial unique index on `effective_changes` for pending status)  
**Testing**: Jest (Unit & Integration), Testcontainers (Real PostgreSQL instance & Kafka integration tests)  
**Target Platform**: Linux / Kubernetes containerized deployment  
**Project Type**: Microservice Web API & Event Consumer (`setting-svc`)  
**Performance Goals**: Department list/hierarchy tree queries < 100ms p95; mutation/scheduling endpoints < 300ms p95; consumer execution latency < 200ms  
**Constraints**: Strict multi-tenant/multi-company isolation (`tenant_id`, `company_id`); future effective dating $\ge$ end of current business day in company timezone; max depth 50 hierarchy loop protection; single pending change per department (`INV-007`); atomic outbox event staging; zero hard deletes; idempotent execution handling  
**Scale/Scope**: Multi-company tenants (1-50 companies per tenant, 1-2000 departments per company)  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Clean Architecture Layering)**: Handled via `DepartmentController` (transport only) $\to$ `DepartmentService` (domain logic, outbox atomicity, hierarchy rules) $\to$ `DepartmentRepository` (persistence & ancestor traversal); cross-module dependencies exposed via barrels.
- [x] **Principle II (Polyrepo Architecture & Cross-Service Contracts)**: `setting-svc` is the sole PostgreSQL domain owner; Go worker interacts purely via Kafka topics (`setting.effective-change.scheduled` $\to$ worker $\to$ `setting.effective-change.execute`).
- [x] **Principle III (TypeScript Rigor & Naming Standards)**: Strict TypeScript (`strict: true`, no `any`), kebab-case filenames (`department.service.ts`, `department.controller.ts`), explicit return types.
- [x] **Principle IV (Testing Discipline & Quality Gates)**: Unit tests for services/controllers, Testcontainers for repository, hierarchy ancestor traversal, and transaction validation, AAA pattern enforced.
- [x] **Principle V (Database Integrity, Transactions & Migrations)**: Database constraints (`ck_departments_not_self_parent`, `uq_departments_company_code`), atomic transactions spanning department entity + setup step + outbox writes, optimistic concurrency locking on pending changes.
- [x] **Principle VI (Security, Authentication & Observability)**: Multi-tenant and company scoping enforced from `RequestContext`, RS256 JWT validation, `@Permissions()` guard, structured JSON logging with correlation IDs.
- [x] **Principle VII (Performance & Scalability)**: Indexed tenant/company/parent queries, cursor/offset pagination support via `@hros/libs-sql`, deduplication via Redis `SETNX`.

## Project Structure

### Documentation (this feature)

```text
specs/009-department-management/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (api-and-events.md)
│   └── api-and-events.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code Layout

```text
src/
├── modules/
│   ├── department/
│   │   ├── controllers/
│   │   │   └── department.controller.ts
│   │   ├── services/
│   │   │   └── department.service.ts
│   │   ├── repositories/
│   │   │   ├── department.repository.ts
│   │   │   └── department.repository.interface.ts
│   │   ├── dtos/
│   │   │   ├── create-department.dto.ts
│   │   │   ├── update-department.dto.ts
│   │   │   ├── deactivate-department.dto.ts
│   │   │   └── query-department.dto.ts
│   │   ├── entities/
│   │   │   └── department.entity.ts
│   │   ├── department.module.ts
│   │   └── index.ts
│   ├── effective-change/
│   │   ├── consumers/
│   │   │   └── effective-change.consumer.ts
│   │   ├── services/
│   │   │   └── effective-change.service.ts
│   │   └── handlers/
│   │       ├── location-apply.handler.ts
│   │       └── department-apply.handler.ts
│   └── company-setup/
│       └── services/
│           └── company-setup.service.ts
└── test/
    ├── unit/
    │   └── department/
    └── integration/
        └── department/
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | N/A |
