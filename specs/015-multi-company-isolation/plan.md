# Implementation Plan: Multi-Company Isolation

**Branch**: `015-multi-company-isolation` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-multi-company-isolation/spec.md`

## Summary

Enforce strict multi-tenant and multi-company data isolation across the Setting Service (`setting-service-api`). Sibling companies within the same enterprise tenant independently own organizational master data (Locations, Departments, Grades, Job Titles, and PoCs) with composite uniqueness `(company_id, code)`, allowing valid code reuse without collisions. Enforce domain invariant validations that prohibit cross-company relational bindings (e.g., Job Title linking to a sibling company's Department/Grade, or cross-company Department parent hierarchies). Apply transport-level scope guards (`TenantScopeGuard`, `CompanyScopeGuard`) and ensure transactional outbox messages emit Kafka events partitioned strictly by `${tenantId}:${companyId}`.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+ (NestJS 10.x, `strict: true`)  
**Primary Dependencies**: `@nestjs/common`, `@nestjs/core`, `typeorm`, `class-validator`, `class-transformer`, `@new-hros/libs-core`, `@new-hros/libs-sql`, `@new-hros/libs-apis`, `@new-hros/libs-events`  
**Storage**: PostgreSQL 18 (TypeORM)  
**Testing**: Jest (Unit & Integration tests following AAA pattern with Testcontainers)  
**Target Platform**: Linux / Docker Container  
**Project Type**: Microservice Web API (`setting-service-api`)  
**Performance Goals**: < 100ms p95 response time for master data and query endpoints; zero partition contention across sibling companies  
**Constraints**: Multi-tenant isolation strictly scoped by `tenant_id` and `company_id`; composite unique constraints on `(company_id, code)` across master tables; domain validation preventing cross-company foreign entity linkages; Kafka partition keys formatted as `${tenantId}:${companyId}`  
**Scale/Scope**: Enterprise multi-tenant HRMS  

## Constitution Check

- [x] **Principle I: Clean Architecture Layering & Module Boundaries** - Transport security in scope guards, business invariants in domain services (`JobTitleService`, `DepartmentService`, `PocService`), and scoped persistence in repositories. Direct repository access from controllers is prohibited.
- [x] **Principle II: Polyrepo Architecture & Cross-Service Contracts** - Independent database ownership by Setting Service; external worker communication via Kafka using Transactional Outbox with composite partition keys (`tenantId:companyId`); employee lookups via local `employee_references` projections.
- [x] **Principle III: TypeScript Rigor & Naming Standards** - Strict TypeScript mode, explicit return types on all public functions/methods, suffix-based kebab-case naming (`company-scope.guard.ts`, `job-title.service.ts`).
- [x] **Principle IV: Testing Discipline & Quality Gates** - Minimum 90% statement/function coverage; comprehensive AAA test suites verifying valid sibling code reuse, rejection of cross-company entity linkages, and guard authorization rejections.
- [x] **Principle V: Database Integrity, Transactions & Migrations** - PostgreSQL composite uniqueness constraints on `(company_id, code)` and `(company_id, poc_type)`; foreign keys with `ON DELETE RESTRICT` for tenant and `ON DELETE CASCADE` for company child records; atomic transaction execution.
- [x] **Principle VI: Security, Authentication & Observability** - RS256 JWT auth, `TenantScopeGuard`, `CompanyScopeGuard`, and `PermissionGuard` at controller boundaries; repository query scoping by `tenant_id` and `company_id`; structured JSON logging carrying tenant and company context.
- [x] **Principle VII: Performance, Caching & Scalability** - Composite indexing on `(company_id, status)` and `(tenant_id, company_id)` ensuring fast lookups without N+1 queries.

## Project Structure

### Documentation (this feature)

```text
specs/015-multi-company-isolation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── multi-company-isolation.contract.md
└── checklists/
    └── requirements.md
```

### Source Code Layout

```text
src/
├── common/
│   ├── guards/
│   │   ├── company-scope.guard.ts           # Validate path companyId against token claims
│   │   ├── tenant-scope.guard.ts            # Validate tenant context consistency
│   │   ├── index.ts
│   │   └── company-scope.guard.spec.ts
│   └── exceptions/
│       ├── cross-company-reference.exception.ts # Custom 400 domain invariant exception
│       └── index.ts
└── modules/
    ├── company/
    │   ├── controllers/
    │   │   └── company.controller.ts        # Attach CompanyScopeGuard
    │   └── services/
    │       └── company.service.ts
    ├── department/
    │   ├── controllers/
    │   │   └── department.controller.ts     # Attach CompanyScopeGuard
    │   └── services/
    │       ├── department.service.ts        # Validate parent department companyId match
    │       └── department.service.spec.ts
    ├── grade/
    │   ├── controllers/
    │   │   └── grade.controller.ts          # Attach CompanyScopeGuard
    │   └── services/
    │       ├── grade.service.ts             # Enforce company-scoped code uniqueness
    │       └── grade.service.spec.ts
    ├── job-title/
    │   ├── controllers/
    │   │   └── job-title.controller.ts      # Attach CompanyScopeGuard
    │   └── services/
    │       ├── job-title.service.ts         # Validate department & grade companyId match
    │       └── job-title.service.spec.ts
    ├── location/
    │   ├── controllers/
    │   │   └── location.controller.ts       # Attach CompanyScopeGuard
    │   └── services/
    │       ├── location.service.ts          # Enforce company-scoped code uniqueness
    │       └── location.service.spec.ts
    ├── poc/
    │   ├── controllers/
    │   │   └── poc.controller.ts            # Attach CompanyScopeGuard
    │   └── services/
    │       ├── poc.service.ts               # Validate employee tenantId and company-scoped assignment
    │       └── poc.service.spec.ts
    └── effective-change/
        ├── handlers/
        │   ├── department-apply.handler.ts
        │   ├── grade-apply.handler.ts
        │   ├── job-title-apply.handler.ts
        │   ├── location-apply.handler.ts
        │   └── poc-apply.handler.ts
        └── services/
            └── effective-change.service.ts  # Isolated company-scoped execution
```

**Structure Decision**: Integrated cross-company validation exceptions in `src/common/exceptions`, scope guards in `src/common/guards`, domain invariant checks within respective domain service modules, and partition key isolation across outbox event producers.

## Complexity Tracking

No constitution violations or unjustified complexities.
