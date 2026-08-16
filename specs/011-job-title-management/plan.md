# Implementation Plan: Job Title Management

**Branch**: `011-job-title-management` | **Date**: 2026-08-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-job-title-management/spec.md`

## Summary

Implement Job Title Management within `setting-svc` to allow authenticated Administrators to configure, update, and deactivate Job Titles scoped strictly to a single Company. Each Job Title is structurally linked to an active Department and Grade within the exact same Company (`ADR-14`, `INV-006`). The solution enforces mandatory future effective dating ($\ge$ end of current business day in the company's timezone), company-scoped code uniqueness (`(company_id, code)`), single pending change constraint (`INV-007`), atomic setup step 5 (`JOB_TITLE`) completion tracking, and outbox event publishing. The state machine transitions via an idempotent Kafka execution consumer (`scheduled` $\to$ `active`, field mutations, and `active` $\to$ `inactive`) with downstream master data event emission and zero hard deletes.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22 LTS / NestJS 10.x  
**Primary Dependencies**: TypeORM, PostgreSQL (`@hros/libs-sql`), NestJS CQRS/Services, Class-Validator / Class-Transformer, Kafka (`@hros/libs-events`, `@nestjs/microservices` / KafkaJS), Redis (`ioredis`, `CacheManager`)  
**Storage**: PostgreSQL 18 (Multi-tenant relational persistence with schema constraints: composite uniqueness `uq_job_titles_company_code` on `(company_id, code)` on `job_titles`, foreign keys to `departments(id)` and `grades(id)`, partial unique index on `effective_changes` for pending status)  
**Testing**: Jest (Unit & Integration), Testcontainers (Real PostgreSQL instance & Kafka integration tests)  
**Target Platform**: Linux / Kubernetes containerized deployment  
**Project Type**: Microservice Web API & Event Consumer (`setting-svc`)  
**Performance Goals**: Job Title list/read queries < 100ms p95; mutation/scheduling endpoints < 300ms p95; consumer execution latency < 200ms  
**Constraints**: Strict multi-tenant/multi-company isolation (`tenant_id`, `company_id`); same-company Department & Grade invariant (`ADR-14`); future effective dating $\ge$ end of current business day in company timezone; single pending change per Job Title (`INV-007`); atomic outbox event staging; zero hard deletes; idempotent execution handling  
**Scale/Scope**: Multi-company tenants (1-50 companies per tenant, 1-1,000 job titles per company)  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Clean Architecture Layering)**: Handled via `JobTitleController` (transport only) $\to$ `JobTitleService` (domain logic, cross-module validation, outbox atomicity) $\to$ `JobTitleRepository` (persistence & company scoping); cross-module dependencies (`DepartmentModule`, `GradeModule`) accessed via exported service/repository providers.
- [x] **Principle II (Polyrepo Architecture & Cross-Service Contracts)**: `setting-svc` is the sole PostgreSQL domain owner; Go worker interacts purely via Kafka topics (`setting.effective-change.scheduled` $\to$ worker $\to$ `setting.effective-change.execute`).
- [x] **Principle III (TypeScript Rigor & Naming Standards)**: Strict TypeScript (`strict: true`, no `any`), kebab-case filenames (`job-title.service.ts`, `job-title.controller.ts`), explicit return types.
- [x] **Principle IV (Testing Discipline & Quality Gates)**: Unit tests for services/controllers, Testcontainers for repository and transaction validation, AAA pattern enforced.
- [x] **Principle V (Database Integrity, Transactions & Migrations)**: Database constraints (`uq_job_titles_company_code`), atomic transactions spanning job title entity + setup step + outbox writes, optimistic concurrency locking on pending changes.
- [x] **Principle VI (Security, Authentication & Observability)**: Multi-tenant and company scoping enforced from `RequestContext`, RS256 JWT validation, `@Permissions()` guard, structured JSON logging with correlation IDs.
- [x] **Principle VII (Performance & Scalability)**: Indexed tenant/company/status queries, cursor/offset pagination support via `@hros/libs-sql`, deduplication via Redis `SETNX`.

## Project Structure

### Documentation (this feature)

```text
specs/011-job-title-management/
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
│   ├── job-title/
│   │   ├── controllers/
│   │   │   └── job-title.controller.ts
│   │   ├── services/
│   │   │   ├── job-title.service.ts
│   │   │   └── job-title-query.service.ts
│   │   ├── repositories/
│   │   │   ├── job-title.repository.ts
│   │   │   └── job-title.repository.interface.ts
│   │   ├── dtos/
│   │   │   ├── create-job-title.dto.ts
│   │   │   ├── update-job-title.dto.ts
│   │   │   ├── deactivate-job-title.dto.ts
│   │   │   └── query-job-title.dto.ts
│   │   ├── entities/
│   │   │   └── job-title.entity.ts
│   │   ├── job-title.module.ts
│   │   └── index.ts
│   ├── effective-change/
│   │   ├── consumers/
│   │   │   └── effective-change.consumer.ts
│   │   ├── services/
│   │   │   └── effective-change.service.ts
│   │   └── handlers/
│   │       ├── location-apply.handler.ts
│   │       ├── department-apply.handler.ts
│   │       ├── grade-apply.handler.ts
│   │       └── job-title-apply.handler.ts
│   └── company-setup/
│       └── services/
│           └── company-setup.service.ts
└── test/
    ├── unit/
    │   └── job-title/
    └── integration/
        └── job-title/
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | N/A |
