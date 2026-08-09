<!--
Sync Impact Report
- Version change: 2.0.0 → 2.1.0
- List of modified principles:
  - Materially expanded Principle I (Clean Architecture Layering & Module Boundaries) with explicit polyrepo & cross-service boundaries from system-architecture.md and product-requirements.md
  - Materially expanded Principle II (Polyrepo Architecture & Cross-Service Contracts) clarifying event-driven Kafka integration, Go Worker boundaries, and outbox pattern
  - Materially expanded Principle III (TypeScript Rigor & Naming Standards) with NestJS & DTO validation guidelines
  - Materially expanded Principle IV (Testing Discipline & Quality Gates) with Testcontainers and AAA standards
  - Materially expanded Principle V (Database Integrity, Transactions & Migrations) detailing soft delete, optimistic locking, zero synchronous direct DB mutations from external workers, and effective-dated organizational state models
  - Materially expanded Principle VI (Security, Authentication & Observability) clarifying multi-tenant isolation, tenant_id scoping, asymmetric JWT RS256, and structured JSON logs
  - Materially expanded Principle VII (Performance, Caching & Scalability) aligning Redis usage, cursor pagination, and asynchronous event workers
- Added sections:
  - Operational & Domain Architecture (Company setup sequencing, template copy-on-create rules, and Go worker task scheduling constraints)
- Removed sections: N/A
- Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ verified
  - .specify/templates/spec-template.md: ✅ verified
  - .specify/templates/tasks-template.md: ✅ verified
- Follow-up TODOs: N/A
-->

# Enterprise HRMS (Setting Service) Constitution

## Core Principles

### I. Clean Architecture Layering & Module Boundaries
The application MUST adhere strictly to clean architecture layering: Controller (transport only, zero business logic) → Service (business logic, transaction boundaries & domain events) → Repository (persistence only). Direct calls bypassing intermediate layers (e.g., controller directly invoking repository methods) are strictly FORBIDDEN. Within the Setting Service repository, domain modules (Company, Location, Department, Grade, Job Title, Point of Contact) MUST remain self-contained; cross-module communication within the service MUST happen exclusively through exported service providers via module index barrels (`index.ts`). Circular dependencies between modules are strictly prohibited.

### II. Polyrepo Architecture & Cross-Service Contracts
Each business domain MUST be built, maintained, and deployed as an independent repository (e.g., `setting-service`, `setting-effective-worker-go`). Cross-service interactions MUST use explicit, versioned contracts over REST (via OpenAPI/Swagger typed clients) or asynchronous Kafka events with versioned schemas managed via Transactional Outbox patterns. Direct database sharing, cross-service database access, or inter-service source code imports (including `workspace:*` npm protocols across repos) are strictly FORBIDDEN. The Setting Service owns its PostgreSQL database exclusively.

### III. TypeScript Rigor & Naming Standards
All TypeScript code MUST run under strict mode (`strict: true`) with zero usage of `any` (use `unknown` and type narrowing). Explicit return types are MANDATORY on all public API methods, exported functions, and service boundaries. Code and file naming MUST strictly follow suffix-based kebab-case conventions (`<domain>.<type>.ts`, e.g., `company.service.ts`) matching physical directory structures. Barrel exports (`index.ts`) MUST re-export public APIs only and avoid deep barrel creation inside `dto/` or `entities/`.

### IV. Testing Discipline & Quality Gates
All business logic MUST be covered by unit tests (minimum 90% statement/function coverage, 85% branch coverage enforced in CI). Tests MUST follow the Arrange-Act-Assert (AAA) pattern. Repositories and database interactions MUST be tested against real PostgreSQL instances via Testcontainers (mocking database engines for query correctness tests is strictly forbidden). CI pipelines MUST enforce linting (`pnpm lint`), type-checking (`tsc --noEmit`), and test suite execution (`pnpm test`) before merging any pull request.

### V. Database Integrity, Transactions & Migrations
Database schemas MUST extend `BaseEntity` (providing UUID primary keys, soft-delete `deletedAt`, audit timestamps, and `@VersionColumn()` optimistic locking where concurrent updates occur). Multi-statement atomic operations MUST be wrapped in explicit service-level transactions. Schema changes MUST be executed exclusively via TypeORM migrations under `src/migrations/` with mandatory `down()` rollback functions (`synchronize: true` is forbidden outside local development sandboxes). Foreign keys, tenant isolation keys (`tenant_id`, `company_id`), and query filter columns MUST be indexed. Effective-dated master data changes (Location, Department, Grade, Job Title, PoC) MUST use scheduled/active/inactive status transitions with transactional outbox event publishing rather than direct un-audited state overwrites.

### VI. Security, Authentication & Observability
Authentication MUST use asymmetric JWT RS256 signing (public key verification across microservices). All domain tables and queries MUST enforce multi-tenant isolation by explicitly scoping data by `tenant_id` (and `company_id` where applicable). Role-Based Access Control (RBAC) MUST be declared at controller boundaries via `@Permissions()` decorators and enforced by `PermissionGuard`. All raw input MUST be validated with `class-validator` DTOs using strict whitelisting (`whitelist: true`, `forbidNonWhitelisted: true`). Logging MUST be structured JSON via `AppLogger` carrying `requestId`, `tenantCode`, `companyId`, and correlation context.

### VII. Performance, Caching & Scalability
List endpoints MUST implement cursor or offset pagination via `@hros/libs-sql`. N+1 queries are review blockers and strictly prohibited; explicit join select projections MUST be used instead of wildcard selections. Caching MUST be routed through `CacheManager` with explicit TTLs for read-heavy master data and company setup configurations—Redis is runtime infrastructure only and MUST NEVER act as a source of truth. Transactional entities MUST NEVER be cached without write-through or event-driven invalidation.

## Operational & Domain Architecture

1. **Company Setup & Activation Lifecycle**:
   - Newly created companies MUST be initialized in `PENDING` status.
   - Company activation (`PENDING` → `ACTIVE`) MUST validate that all 8 mandatory setup steps (Company Info, Location, Department, Grade, Job Title, PoC, Roles, Employee Import) are completed.
   - Company configuration template copying MUST be strictly **copy-on-create**; live configuration inheritance between companies is strictly prohibited.

2. **Effective-Dated Worker Boundaries**:
   - The Go worker service (`setting-effective-worker-go`) acts strictly as an execution scheduler via Asynq and Kafka.
   - The Go worker MUST NOT have direct access, driver connections, or credentials to the Setting Service PostgreSQL database. Domain authority and state mutation MUST remain exclusively within the NestJS Setting Service.

## Technology Stack & Infrastructure

The project standardizes on the following core tech stack:
- **Framework & Language**: NestJS (latest), TypeScript (`strict: true`), pnpm package manager.
- **Data & Persistence**: PostgreSQL 18 (ACID relational), TypeORM, Redis (via `CacheManager`).
- **Communication & Integration**: RESTful APIs (versioned), OpenAPI/Swagger, Kafka (asynchronous event messaging via Transactional Outbox).
- **Containerization & Deployment**: Docker (immutable images), Kubernetes (declarative orchestration).
- **Tooling & Quality**: ESLint, Prettier, Husky, Commitlint (Conventional Commits format).
- **Shared Libraries**: `@hros/libs-core`, `@hros/libs-sql`, `@hros/libs-apis`, `@hros/libs-events` consumed as independently versioned npm packages.

## Workflow & Quality Gates

1. **Commit & PR Hygiene**:
   - Commits MUST follow Conventional Commits (`feat(scope): ...`, `fix(scope): ...`).
   - PR descriptions MUST state *what* changed and *why*, linking to explicit issues.
   - All code MUST pass `pnpm lint` and `pnpm test` locally and in CI.

2. **Database & Schema Rollout**:
   - Database migrations MUST follow the expand/contract pattern for zero-downtime compatibility.
   - Every migration MUST be reviewed and include a tested rollback (`down()`).

3. **API & Contract Evolution**:
   - Breaking API changes REQUIRE a major API version increment and documented deprecation window.
   - Swagger decorators MUST completely describe request DTOs, response DTOs, and expected HTTP status codes.

## Governance

- **Supremacy**: This Constitution supersedes all informal team practices, local conventions, and unwritten rules across the service codebase.
- **Compliance & PR Reviews**: All pull requests MUST be verified for compliance against this Constitution and the accompanying `coding-conventions.md`, `implementation-rules.md`, `product-requirements.md`, `system-architecture.md`, `tech-stack.md`, `testing-strategy.md`, and `repository-structure.md`.
- **Amendments**: Amendments to this Constitution require formal review, rationale documentation, and a version bump:
  - **MAJOR**: Backward-incompatible governance or principle removals / redefinitions.
  - **MINOR**: Addition of new principles or significant structural guidance expansion.
  - **PATCH**: Non-semantic clarifications, typo fixes, or wording updates.

**Version**: 2.1.0 | **Ratified**: 2026-08-08 | **Last Amended**: 2026-08-09
