# Implementation Plan: Default Company Designation

**Branch**: `006-default-company-designation` | **Date**: 2026-08-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-default-company-designation/spec.md` with clarifications

## Summary

Implement the Default Company Designation feature allowing an authenticated Tenant Administrator to convert/transfer the Default Company (configuration template) designation from the current default company to a target company within the tenant. The system enforces the single default template invariant per tenant at both application and database schema levels, atomically resets `is_template = false` on the source default company and sets `is_template = true` on the target company in a single database transaction, with zero asynchronous domain event publishing required.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22 LTS / NestJS 10.x
**Primary Dependencies**: TypeORM, PostgreSQL (`@hros/libs-sql`), Class-Validator / Class-Transformer, Redis (`ioredis`)
**Storage**: PostgreSQL 18 (Multi-tenant relational persistence with partial unique index `uq_companies_one_template_per_tenant`)
**Testing**: Jest (Unit & Integration), Testcontainers (Real PostgreSQL database tests)
**Target Platform**: Linux / Kubernetes containerized deployment
**Project Type**: Microservice Web API (`setting-svc`)
**Performance Goals**: Designation transfer processing in < 300ms p95
**Constraints**: Zero cross-tenant leakage; strict single template invariant per tenant; atomic designation transfer in one database transaction; no event publishing required
**Scale/Scope**: Multi-company tenants (typically 1-50 companies per tenant)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Clean Architecture Layering)**: Handled via Controller -> Service -> Repository layering; no direct controller DB calls.
- [x] **Principle II (Polyrepo Architecture & Cross-Service Contracts)**: Internal setting state management with clean interfaces; no unauthorized shared state.
- [x] **Principle III (TypeScript Rigor & Naming Standards)**: Strict types, permission-guarded endpoint (`@RequirePermission('company:update')`), kebab-case file naming.
- [x] **Principle IV (Testing Discipline & Quality Gates)**: Unit tests for service, controller, and repository; database constraint validation.
- [x] **Principle V (Database Integrity, Transactions & Migrations)**: All updates wrapped in `TransactionService.runInTransaction` / explicit `EntityManager` atomicity; partial unique index `uq_companies_one_template_per_tenant` on `companies(tenant_id) WHERE is_template = true`.
- [x] **Principle VI (Security, Authentication & Observability)**: Multi-tenant scoping enforced (`tenant_id = RequestContext.tenantId`), RS256 JWT validation, structured logging with correlation context.
- [x] **Principle VII (Performance & Scalability)**: Targeted column updates without full table locks; idempotent requests handled efficiently.

## Project Structure

### Documentation (this feature)

```text
specs/006-default-company-designation/
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
│   │   │   └── company.service.ts
│   │   ├── repositories/
│   │   │   └── company.repository.ts
│   │   ├── entities/
│   │   │   └── company.entity.ts
│   │   └── company.module.ts
└── tests/
    ├── unit/
    └── integration/
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | N/A |
