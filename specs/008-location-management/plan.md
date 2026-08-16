# Implementation Plan: Location Management

**Branch**: `008-location-management` | **Date**: 2026-08-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-location-management/spec.md`

## Summary

Implement Location Management within `setting-svc` to allow Administrators to define, update, and deactivate physical and administrative work locations scoped to a single Company. The solution enforces future effective dating ($\ge$ end of current business day in Company's timezone) on all write operations, atomically writes scheduled records and Transactional Outbox events, tracks company onboarding setup progress (`LOCATION` step), and exposes an idempotent Kafka execution consumer to perform state transitions (`scheduled` $\to$ `active`, field updates, and `active` $\to$ `inactive`) while guaranteeing data integrity without hard deletes.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22 LTS / NestJS 10.x
**Primary Dependencies**: TypeORM, PostgreSQL (`@hros/libs-sql`), NestJS CQRS/Services, Class-Validator / Class-Transformer, Kafka (`@hros/libs-events`, `@nestjs/microservices` / KafkaJS), Redis (`ioredis`, `CacheManager`)
**Storage**: PostgreSQL 18 (Multi-tenant relational persistence with schema constraints: composite uniqueness `(company_id, code)`, partial unique index `uq_locations_one_headquarter_per_company` on `company_id` WHERE `is_headquarter = true AND status <> 'inactive'`)
**Testing**: Jest (Unit & Integration), Testcontainers (Real PostgreSQL instance & Kafka integration tests)
**Target Platform**: Linux / Kubernetes containerized deployment
**Project Type**: Microservice Web API & Event Consumer (`setting-svc`)
**Performance Goals**: Location list/detail queries < 100ms p95; mutation and scheduling requests < 300ms p95; consumer execution latency < 200ms
**Constraints**: Strict multi-tenant/multi-company isolation (`tenant_id`, `company_id`); future effective dating $\ge$ end of current business day in company timezone; single pending change per location (`INV-007`); atomic outbox event publishing; zero hard deletes; idempotent execution handling
**Scale/Scope**: Multi-company tenants (1-50 companies per tenant, 1-1000 locations per company)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Clean Architecture Layering)**: Handled via `LocationController` (transport) $\to$ `LocationService` (domain logic, outbox atomicity) $\to$ `LocationRepository` (persistence); cross-module dependencies exposed via barrels.
- [x] **Principle II (Polyrepo Architecture & Cross-Service Contracts)**: `setting-svc` is the sole PostgreSQL domain owner; Go worker interacts purely via Kafka topics (`setting.effective-change.scheduled` $\to$ worker $\to$ `setting.effective-change.execute`).
- [x] **Principle III (TypeScript Rigor & Naming Standards)**: Strict TypeScript (`strict: true`, no `any`), kebab-case filenames (`location.service.ts`, `location.controller.ts`), explicit return types.
- [x] **Principle IV (Testing Discipline & Quality Gates)**: Unit tests for services/controllers, Testcontainers for repository and transaction validation, AAA pattern enforced.
- [x] **Principle V (Database Integrity, Transactions & Migrations)**: Migrations for schema constraints (partial unique headquarter index, composite code index), atomic transactions spanning entity + setup step + outbox writes, optimistic concurrency locking on pending changes.
- [x] **Principle VI (Security, Authentication & Observability)**: Multi-tenant and company scoping enforced from `RequestContext`, RS256 JWT validation, `@Permissions()` guard, structured JSON logging with correlation IDs.
- [x] **Principle VII (Performance & Scalability)**: Indexed tenant/company/code queries, cursor/offset pagination support via `@hros/libs-sql`, deduplication via Redis `SETNX`.

## Project Structure

### Documentation (this feature)

```text
specs/008-location-management/
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
│   ├── location/
│   │   ├── controllers/
│   │   │   └── location.controller.ts
│   │   ├── services/
│   │   │   └── location.service.ts
│   │   ├── repositories/
│   │   │   ├── location.repository.ts
│   │   │   └── location.repository.interface.ts
│   │   ├── dtos/
│   │   │   ├── create-location.dto.ts
│   │   │   ├── update-location.dto.ts
│   │   │   ├── deactivate-location.dto.ts
│   │   │   └── query-location.dto.ts
│   │   ├── entities/
│   │   │   └── location.entity.ts
│   │   ├── location.module.ts
│   │   └── index.ts
│   ├── effective-change/
│   │   ├── consumers/
│   │   │   └── effective-change.consumer.ts
│   │   ├── services/
│   │   │   └── effective-change.service.ts
│   │   └── handlers/
│   │       └── location-apply.handler.ts
│   └── company-setup/
│       └── services/
│           └── company-setup.service.ts
└── tests/
    ├── unit/
    │   └── location/
    └── integration/
        └── location/
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | N/A |
