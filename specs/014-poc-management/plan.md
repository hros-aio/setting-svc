# Implementation Plan: Organization Responsibility (Point of Contact) Management

**Branch**: `014-poc-management` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-poc-management/spec.md`

## Summary

Implement Organization Responsibility (Point of Contact) Management in the Setting Service. Authenticated Administrators can assign, replace, and deactivate company-scoped Points of Contact (`COUNTRY_HEAD`, `HR_HEAD`, `FINANCE_HEAD`, `IT_HEAD`, `PAYROLL_OWNER`) as standalone assignments independent of structural records (Location, Department, Grade, Job Title). Mutations are governed by the effective-dating engine (`effective_changes`, transactional outbox events, and Go worker scheduled execution callback), validated against local `employee_references` projections, and automatically mark Company Setup Step 8 (`POC`) as complete upon initial assignment.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+ (NestJS 10.x, `strict: true`)  
**Primary Dependencies**: `@nestjs/common`, `@nestjs/core`, `typeorm`, `class-validator`, `class-transformer`, `@new-hros/libs-core`, `@new-hros/libs-sql`, `@new-hros/libs-apis`, `@new-hros/libs-events`  
**Storage**: PostgreSQL 18 (TypeORM)  
**Testing**: Jest (Unit & Integration tests following AAA pattern)  
**Target Platform**: Linux / Docker Container  
**Project Type**: Microservice Web API (`setting-service-api`)  
**Performance Goals**: < 100ms p95 response time for assignment/replacement commands  
**Constraints**: Multi-tenant isolation strictly scoped by `tenant_id` and `company_id`; partial unique index enforcing one active/scheduled PoC per type per company; single pending change per entity; atomic transaction for status changes + outbox event + setup step completion  
**Scale/Scope**: Enterprise multi-tenant HRMS  

## Constitution Check

- [x] **Principle I: Clean Architecture Layering & Module Boundaries** - Transport handled in `PocController`, domain logic and transaction boundaries in `PocService` / `PocQueryService`, persistence encapsulated in `PocRepository`, and cross-module boundaries strictly maintained via exported services.
- [x] **Principle II: Polyrepo Architecture & Cross-Service Contracts** - Asynchronous integration with Go Worker via Kafka (`setting.effective-change.scheduled`, `setting.effective-change.execute`) using Transactional Outbox pattern; employee validation performed locally against read-only projection `employee_references`.
- [x] **Principle III: TypeScript Rigor & Naming Standards** - Strict TypeScript mode, explicit return types on all service and repository methods, kebab-case file naming matching physical directory structure (`poc.service.ts`, `poc-apply.handler.ts`).
- [x] **Principle IV: Testing Discipline & Quality Gates** - Comprehensive unit and integration test coverage for initial assignment, replacement conflicts, deactivation, idempotent apply handler execution, and setup step completion.
- [x] **Principle V: Database Integrity, Transactions & Migrations** - PostgreSQL partial unique index `uq_pocs_one_active_per_type` on `(company_id, poc_type) WHERE status <> 'inactive'`, atomic operations wrapped in `TransactionService.runInTransaction`.
- [x] **Principle VI: Security, Authentication & Observability** - RS256 JWT auth via `AuthGuard`, RBAC permissions via `PermissionGuard` (`poc:create`, `poc:update`, `poc:deactivate`, `poc:read`), strict multi-tenant isolation by `tenant_id` and `company_id`.
- [x] **Principle VII: Performance, Caching & Scalability** - Optimized indexed queries on `(tenant_id, company_id, status)` and `(tenant_id, employee_id)` preventing N+1 queries.

## Project Structure

### Documentation (this feature)

```text
specs/014-poc-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── poc-management.contract.md
└── checklists/
    └── requirements.md
```

### Source Code Layout

```text
src/
├── enums/
│   ├── event-type.enum.ts                 # Add PocEventType (setting.poc.assigned, etc.)
│   └── index.ts
└── modules/
    ├── effective-change/
    │   ├── handlers/
    │   │   └── poc-apply.handler.ts       # Apply handler for PoC effective changes
    │   └── effective-change.module.ts
    ├── employee-reference/
    │   ├── repositories/
    │   │   └── employee-reference.repository.ts # Read-only employee lookups
    │   └── employee-reference.module.ts
    └── poc/
        ├── controllers/
        │   ├── poc.controller.ts          # Endpoints under /companies/:companyId/pocs
        │   └── poc.controller.spec.ts
        ├── dtos/
        │   ├── create-poc.dto.ts
        │   ├── replace-poc.dto.ts
        │   ├── deactivate-poc.dto.ts
        │   └── query-poc.dto.ts
        ├── entities/
        │   └── poc.entity.ts              # PocEntity
        ├── repositories/
        │   ├── poc.repository.interface.ts
        │   ├── poc.repository.ts
        │   └── poc.repository.spec.ts
        ├── services/
        │   ├── poc.service.ts             # Domain mutations & setup step integration
        │   ├── poc.service.spec.ts
        │   ├── poc-query.service.ts       # Active list & history queries
        │   └── poc-query.service.spec.ts
        ├── index.ts
        └── poc.module.ts
```

**Structure Decision**: Standalone `PocModule` within `src/modules/poc` paired with `PocApplyHandler` in `EffectiveChangeModule`, adhering to modular clean architecture and established effective-dating patterns.

## Complexity Tracking

No constitution violations or unjustified complexities.
