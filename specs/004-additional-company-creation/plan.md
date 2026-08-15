# Implementation Plan: Additional Company Creation

**Branch**: `004-additional-company-creation` | **Date**: 2026-08-15 | **Spec**: [spec.md](file:///home/ren0503/new-hros/admin-module/setting-svc/specs/004-additional-company-creation/spec.md)

**Input**: Feature specification from `/specs/004-additional-company-creation/spec.md`

## Summary

Implement additional company creation within tenant boundaries, allowing tenant administrators to create new legal entities in `PENDING` status. The implementation coordinates point-in-time snapshot master data copying (Grades, Job Titles, Organization Responsibilities) from a tenant Default Company (`is_template = true`), seeds the 8-step setup sequence, writes domain events via the Transactional Outbox pattern, and handles asynchronous role copy completion events via Kafka.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22 LTS / NestJS 10.x
**Primary Dependencies**: TypeORM, PostgreSQL (`@hros/libs-sql`), NestJS Microservices / Kafka (`@hros/libs-events`), Class-Validator / Class-Transformer, Redis (`ioredis`)
**Storage**: PostgreSQL 18 (Multi-tenant relational persistence with schema migration), Redis (Deduplication & Idempotency caching)
**Testing**: Jest (Unit & Integration), Testcontainers (Real PostgreSQL database tests)
**Target Platform**: Linux / Kubernetes containerized deployment
**Project Type**: Microservice Web API / Event Consumer (`setting-svc`)
**Performance Goals**: Company creation with snapshot copy execution in < 1.5s p95
**Constraints**: Zero cross-tenant data leakage; strict transactional consistency across entity insertion, template copy, step seeding, and outbox event persistence; zero direct role manipulation (role ownership remains in Authorization domain)
**Scale/Scope**: Multi-company tenants (typically 1-50 companies per tenant)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Clean Architecture Layering)**: Handled via DTO -> Controller -> Service/Command -> Repository layering; no direct controller DB calls.
- [x] **Principle II (Polyrepo Architecture & Cross-Service Contracts)**: Role copying is delegated asynchronously via Transactional Outbox and Kafka; zero shared databases.
- [x] **Principle III (TypeScript Rigor & Naming Standards)**: Strict types, DTO validation, kebab-case file naming (`template-copy.service.ts`).
- [x] **Principle IV (Testing Discipline & Quality Gates)**: Unit tests for services and repository tests with Testcontainers.
- [x] **Principle V (Database Integrity, Transactions & Migrations)**: All creation writes wrapped in `withTransaction` atomicity with proper indexes (`uq_companies_tenant_code`).
- [x] **Principle VI (Security, Authentication & Observability)**: Multi-tenant scoping enforced (`tenant_id = RequestContext.tenantId`), RS256 JWT validation, structured logging.
- [x] **Principle VII (Performance & Scalability)**: Redis deduplication for Kafka consumer, efficient batch inserts for copied master data.

## Project Structure

### Documentation (this feature)

```text
specs/004-additional-company-creation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (api-and-events.md)
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code Layout

```text
src/
├── modules/
│   ├── company/
│   │   ├── controllers/
│   │   │   └── company.controller.ts
│   │   ├── services/
│   │   │   ├── company.service.ts
│   │   │   ├── template-copy.service.ts
│   │   │   └── setup-step-seeder.service.ts
│   │   ├── repositories/
│   │   │   ├── company.repository.ts
│   │   │   └── company-setup-step.repository.ts
│   │   ├── dto/
│   │   │   ├── create-company.dto.ts
│   │   │   └── company-response.dto.ts
│   │   └── company.module.ts
│   ├── kafka/
│   │   ├── consumers/
│   │   │   └── role-copy-completed.consumer.ts
│   │   └── kafka.module.ts
│   └── outbox/
│       ├── services/
│       │   └── outbox.service.ts
│       └── outbox.module.ts
└── tests/
    ├── unit/
    └── integration/
```

**Structure Decision**: Standard NestJS domain module structure matching the existing `setting-svc` layout under `src/modules/company`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
