# Implementation Plan: Company Activation

**Branch**: `013-company-activation` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-company-activation/spec.md`

## Summary

Enable an authenticated Administrator to explicitly activate a company in `PENDING` status. The backend revalidates server-side that all 8 mandatory setup steps are marked `COMPLETED` in `company_setup_steps`, transitions the company status to `ACTIVE`, populates activation audit metadata (`activatedAt`, `activatedBy`), and writes a transactional outbox event (`company.activated`) inside an atomic database transaction. Re-activation of already `ACTIVE` companies is rejected, and automatic activation is strictly prohibited.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+ (NestJS 10.x, `strict: true`)  
**Primary Dependencies**: `@nestjs/common`, `@nestjs/core`, `typeorm`, `@new-hros/libs-core`, `@new-hros/libs-sql`, `@new-hros/libs-apis`, `@new-hros/libs-events`  
**Storage**: PostgreSQL 18 (TypeORM)  
**Testing**: Jest (Unit & Integration tests following AAA pattern)  
**Target Platform**: Linux / Docker Container  
**Project Type**: Microservice Web API (`setting-service-api`)  
**Performance Goals**: < 100ms p95 response time for activation command  
**Constraints**: Multi-tenant isolation scoped by `tenant_id`; atomic transaction for status update + outbox event; RBAC Administrator guard  
**Scale/Scope**: Enterprise multi-tenant HRMS  

## Constitution Check

- [x] **Principle I: Clean Architecture Layering & Module Boundaries** - Controller handles transport, delegates to `CompanyService` / `CompanySetupQueryService`, persistence encapsulated in `CompanyRepository` & `OutboxEventEntity`.
- [x] **Principle II: Polyrepo Architecture & Cross-Service Contracts** - Domain event `company.activated` published reliably via Transactional Outbox pattern without direct database coupling to other services.
- [x] **Principle III: TypeScript Rigor & Naming Standards** - Strict TypeScript, explicit return types, kebab-case file naming convention (`company-activation.exception.ts`, `company.service.ts`).
- [x] **Principle IV: Testing Discipline & Quality Gates** - Comprehensive unit and integration test suites covering happy paths, incomplete setup rejection, already-active edge cases, and tenant isolation.
- [x] **Principle V: Database Integrity, Transactions & Migrations** - Atomic transaction via `TransactionService.runInTransaction` wrapping the status update and outbox insert; no orphaned states.
- [x] **Principle VI: Security, Authentication & Observability** - RS256 JWT auth via `AuthGuard`, RBAC permissions via `PermissionGuard`, strict multi-tenant scoping by `tenant_id`.
- [x] **Principle VII: Performance, Caching & Scalability** - Live atomic DB transaction, cache invalidation / idempotency headers support.

## Project Structure

### Documentation (this feature)

```text
specs/013-company-activation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── company-activation.contract.md
└── checklists/
    └── requirements.md
```

### Source Code Layout

```text
src/
├── enums/
│   └── event-type.enum.ts                 # Ensure COMPANY_ACTIVATED is defined ('company.activated')
└── modules/
    └── company/
        ├── controllers/
        │   ├── company.controller.ts      # POST /companies/:id/activate endpoint
        │   └── company.controller.spec.ts
        ├── exceptions/
        │   └── company-activation-rejected.exception.ts # Structured 422 exception for incomplete steps
        ├── repositories/
        │   ├── company.repository.ts      # activateCompany helper or direct updateCompanyInfo
        │   └── company.repository.spec.ts
        ├── services/
        │   ├── company.service.ts         # activateCompany domain method with TransactionService
        │   ├── company.service.spec.ts
        │   └── company-setup-query.service.ts # validateAllStepsCompleted
        └── company.module.ts
```

**Structure Decision**: Integrated within the existing `CompanyModule` and `CompanyService` to maintain single domain ownership of company lifecycle state transitions.

## Complexity Tracking

No constitution violations or unjustified complexities.
