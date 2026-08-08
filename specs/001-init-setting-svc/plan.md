# Implementation Plan: Init Setting Service Infrastructure

**Branch**: `001-init-project` | **Date**: 2026-08-08 | **Spec**: [spec.md](file:///home/ren0503/new-hros/admin-module/setting-svc/specs/001-init-setting-svc/spec.md)

**Input**: Feature specification from `/specs/001-init-setting-svc/spec.md`

## Summary

Initialize `hrms-setting-service` using NestJS and TypeScript, integrating shared libraries (`libs-core`, `libs-sql`, `libs-apis`), establishing PostgreSQL and Redis infrastructure connection handling, configuring global route prefix `/setting-api`, exposing health check endpoints, and ensuring graceful termination.

## Technical Context

**Language/Version**: Node.js v20 LTS, TypeScript 5.x (`strict: true`)

**Primary Dependencies**: NestJS v10+, TypeORM, Redis (via `@hrms/libs-core` CacheManager), `@nestjs/terminus`

**Storage**: PostgreSQL (via `@hrms/libs-sql` BaseRepository & TypeORM), Redis

**Testing**: Jest (Unit & Service tests), Testcontainers (PostgreSQL & Redis Integration), Supertest (E2E)

**Target Platform**: Linux / Docker container in Kubernetes

**Project Type**: NestJS Web Service (microservice backend)

**Performance Goals**: App startup <5s, Health check response <50ms p95

**Constraints**: Strict route prefix `/setting-api`, zero `any`, clean shutdown handling

**Scale/Scope**: Foundation layer for Setting microservice

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Clean Architecture Layering & Module Boundaries** -> PASS: Controller (health transport) -> Service -> Repository/Infra layers enforced.
- **Principle II: Polyrepo Architecture & Cross-Service Contracts** -> PASS: Independent `hrms-setting-service` repository with `/setting-api` prefix.
- **Principle III: TypeScript Rigor & Naming Standards** -> PASS: `strict: true`, kebab-case filenames, explicit return types on public methods.
- **Principle IV: Testing Discipline & Quality Gates** -> PASS: AAA pattern, Testcontainers for database integration, 90% unit test threshold target.
- **Principle V: Database Integrity, Transactions & Migrations** -> PASS: TypeORM connection pooling, no direct sync in production.
- **Principle VI: Security, Authentication & Observability** -> PASS: Structured JSON logging with `AppLogger`, global route prefix.
- **Principle VII: Performance, Caching & Scalability** -> PASS: Redis connection via `CacheManager` with explicit TTLs.

## Project Structure

### Documentation (this feature)

```text
specs/001-init-setting-svc/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 interface contracts
│   └── health.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── modules/
│   └── health/
│       ├── controllers/
│       │   └── health.controller.ts
│       ├── services/
│       │   └── health.service.ts
│       ├── health.module.ts
│       └── index.ts
├── config/
│   └── infrastructure.config.ts
├── app.module.ts
└── main.ts

test/
├── health.e2e-spec.ts
└── jest-e2e.json
```

**Structure Decision**: Single NestJS web service project following the standard repository structure defined in `repository-structure.md`.

## Complexity Tracking

> No violations found. All design decisions align with project constitution principles.
