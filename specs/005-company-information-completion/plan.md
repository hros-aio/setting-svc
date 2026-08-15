# Implementation Plan: Company Information Completion

**Branch**: `005-company-information-completion` | **Date**: 2026-08-15 | **Spec**: [spec.md](file:///home/ren0503/new-hros/admin-module/setting-svc/specs/005-company-information-completion/spec.md)

**Input**: Feature specification from `/specs/005-company-information-completion/spec.md`

## Summary

Implement the Company Information Completion feature allowing Tenant Administrators to review, complete, and update company profile attributes and legal entity information for `PENDING` or `ACTIVE` companies. The feature persists updates to `companies`, automatically transitions Setup Step 1 (`COMPANY_INFORMATION`) to `COMPLETED` in `company_setup_steps` with audit timestamps, generates `company.updated` domain events via Transactional Outbox atomically, and supports idempotent retries.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22 LTS / NestJS 10.x
**Primary Dependencies**: TypeORM, PostgreSQL (`@hros/libs-sql`), NestJS Microservices / Kafka (`@hros/libs-events`), Class-Validator / Class-Transformer, Redis (`ioredis`)
**Storage**: PostgreSQL 18 (Multi-tenant relational persistence with schema migration), Redis (Deduplication & Idempotency caching)
**Testing**: Jest (Unit & Integration), Testcontainers (Real PostgreSQL database tests)
**Target Platform**: Linux / Kubernetes containerized deployment
**Project Type**: Microservice Web API / Event Producer (`setting-svc`)
**Performance Goals**: Company information update and step completion in < 1.0s p95
**Constraints**: Zero cross-tenant data leakage; strict transactional consistency across company entity update, setup step status transition, and outbox event persistence; support idempotent requests
**Scale/Scope**: Multi-company tenants (typically 1-50 companies per tenant)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Clean Architecture Layering)**: Handled via DTO -> Controller -> Service -> Repository layering; no direct controller DB calls.
- [x] **Principle II (Polyrepo Architecture & Cross-Service Contracts)**: Company update events emitted via Transactional Outbox to Kafka; zero shared databases.
- [x] **Principle III (TypeScript Rigor & Naming Standards)**: Strict types, DTO validation with `class-validator`, kebab-case file naming (`update-company-information.dto.ts`).
- [x] **Principle IV (Testing Discipline & Quality Gates)**: Unit tests for services and controller; repository tests with Testcontainers.
- [x] **Principle V (Database Integrity, Transactions & Migrations)**: All updates wrapped in `TransactionService.runInTransaction` / explicit entity manager atomicity.
- [x] **Principle VI (Security, Authentication & Observability)**: Multi-tenant scoping enforced (`tenant_id = RequestContext.tenantId`), RS256 JWT validation, structured logging with correlation context.
- [x] **Principle VII (Performance & Scalability)**: Redis idempotency caching, targeted column updates without full table locks.

## Project Structure

### Documentation (this feature)

```text
specs/005-company-information-completion/
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
│   │   │   ├── update-company-information.dto.ts
│   │   │   ├── create-company.dto.ts
│   │   │   └── company-response.dto.ts
│   │   ├── entities/
│   │   │   ├── company.entity.ts
│   │   │   ├── company-setup-step.entity.ts
│   │   │   └── outbox-event.entity.ts
│   │   └── company.module.ts
│   └── outbox/
└── tests/
    ├── unit/
    └── integration/
```

**Structure Decision**: Standard NestJS domain module structure matching the existing `setting-svc` layout under `src/modules/company`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | N/A |
