# Implementation Plan: Employee Transfer Between Companies

**Branch**: `016-employee-transfer` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-employee-transfer/spec.md`

## Summary

Implement the backend workflow for Employee Transfer Between Companies within the Setting Service. Authenticated Administrators can schedule inter-company transfers with a mandatory future effective date ($\ge$ end of current business day). The system validates destination company `ACTIVE` status and ensures destination master data (Location, Department, Grade, Job Title) strictly belongs to the destination company. Dual-write safety is guaranteed via transactional outbox (`setting.effective-change.scheduled`), single-pending-transfer invariant is enforced at database and application levels, and automated execution seamlessly transitions employee attribution (`employee_references.company_id`) to the destination company while preserving continuous employment records and publishing `employee.company-transferred`.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+ (NestJS 10.x, `strict: true`)  
**Primary Dependencies**: `@nestjs/common`, `@nestjs/core`, `typeorm`, `class-validator`, `class-transformer`, `@new-hros/libs-core`, `@new-hros/libs-sql`, `@new-hros/libs-apis`, `@new-hros/libs-events`  
**Storage**: PostgreSQL 18 (TypeORM)  
**Testing**: Jest (Unit & Testcontainers integration tests following AAA pattern)  
**Target Platform**: Linux / Docker Container  
**Project Type**: Microservice Web API (`setting-service-api`)  
**Performance Goals**: < 100ms p95 response time for transfer initiation and validation commands  
**Constraints**: Multi-tenant isolation strictly scoped by `tenant_id`; partial unique index `uq_employee_pending_transfer` on `(tenant_id, employee_id) WHERE status = 'PENDING'`; atomic PostgreSQL transactions for state changes + outbox event writes; continuous employment preservation (no termination/re-hire side-effects)  
**Scale/Scope**: Enterprise multi-tenant HRMS  

## Constitution Check

- [x] **Principle I: Clean Architecture Layering & Module Boundaries** - Transport handled in `EmployeeTransferController`, domain orchestration and transaction boundaries in `EmployeeTransferService`, persistence encapsulated in `EmployeeTransferRepository`, cross-module master data queries via exported service providers (`CompanyService`, `LocationService`, `DepartmentService`, `GradeService`, `JobTitleService`, `EmployeeReferenceService`).
- [x] **Principle II: Polyrepo Architecture & Cross-Service Contracts** - Asynchronous integration with external Go worker scheduler via Kafka (`setting.effective-change.scheduled`) and downstream domains via `employee.company-transferred` using Transactional Outbox pattern; zero direct DB sharing.
- [x] **Principle III: TypeScript Rigor & Naming Standards** - Strict TypeScript mode (`strict: true`), explicit return types across all public/service methods, kebab-case file naming (`employee-transfer.service.ts`, `employee-transfer.entity.ts`).
- [x] **Principle IV: Testing Discipline & Quality Gates** - Unit tests for validation, future-date boundaries, duplicate pending transfer rejections, and execution idempotency; integration tests with Testcontainers against PostgreSQL.
- [x] **Principle V: Database Integrity, Transactions & Migrations** - PostgreSQL partial unique index `uq_employee_pending_transfer` on `(tenant_id, employee_id) WHERE status = 'PENDING'`; all state mutations wrapped in ACID transactions with TypeORM migration.
- [x] **Principle VI: Security, Authentication & Observability** - RS256 JWT auth via `AuthGuard`, RBAC permissions via `PermissionGuard` (`employee-transfer:create`, `employee-transfer:read`), strict multi-tenant isolation by `tenant_id` and `company_id`.
- [x] **Principle VII: Performance, Caching & Scalability** - Indexed queries on `(tenant_id, employee_id)` and `(status, effective_at)`, Redis deduplication key `SETNX` on execution triggers, zero N+1 queries.

## Project Structure

### Documentation (this feature)

```text
specs/016-employee-transfer/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── employee-transfer.contract.md
└── checklists/
    └── requirements.md
```

### Source Code Layout

```text
src/
├── enums/
│   ├── aggregate-type.enum.ts                 # Add AggregateType.EMPLOYEE_TRANSFER
│   ├── event-type.enum.ts                     # Add EmployeeTransferEventType / EventType
│   ├── table-name.enum.ts                     # Add TableName.EMPLOYEE_TRANSFERS
│   └── index.ts
├── migrations/
│   └── 1724000000000-create-employee-transfers-table.ts # Migration with up() and down()
└── modules/
    ├── effective-change/
    │   ├── handlers/
    │   │   └── employee-transfer-apply.handler.ts # Apply handler for scheduled execution
    │   └── effective-change.module.ts
    └── employee-transfer/
        ├── controllers/
        │   ├── employee-transfer.controller.ts    # REST endpoints
        │   └── employee-transfer.controller.spec.ts
        ├── dtos/
        │   ├── initiate-employee-transfer.dto.ts  # Input validation DTO
        │   ├── query-employee-transfer.dto.ts     # Query DTO
        │   └── employee-transfer-response.dto.ts  # Response DTO
        ├── entities/
        │   └── employee-transfer.entity.ts        # EmployeeTransferEntity
        ├── repositories/
        │   ├── employee-transfer.repository.interface.ts
        │   ├── employee-transfer.repository.ts
        │   └── employee-transfer.repository.spec.ts
        ├── services/
        │   ├── employee-transfer.service.ts       # Domain logic, initiation & execution
        │   └── employee-transfer.service.spec.ts
        ├── index.ts
        └── employee-transfer.module.ts
```

**Structure Decision**: Dedicated `EmployeeTransferModule` in `src/modules/employee-transfer` paired with `EmployeeTransferApplyHandler` in `EffectiveChangeModule`, adhering to modular clean architecture and established transactional outbox patterns.

## Complexity Tracking

No constitution violations or unjustified complexities.
