<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0
- List of modified principles:
  - Added Principle I: Clean Architecture Layering & Module Boundaries
  - Added Principle II: Polyrepo Architecture & Cross-Service Contracts
  - Added Principle III: TypeScript Rigor & Naming Standards
  - Added Principle IV: Testing Discipline & Quality Gates
  - Added Principle V: Database Integrity, Transactions & Migrations
  - Added Principle VI: Security, Authentication & Observability
  - Added Principle VII: Performance, Caching & Scalability
- Added sections:
  - Core Principles
  - Technology Stack & Infrastructure
  - Workflow & Quality Gates
  - Governance
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
The application MUST adhere strictly to clean architecture layering: Controller (transport only) → Service (business logic & transaction boundaries) → Repository (persistence only). Direct calls bypassing intermediate layers (e.g. controller calling repository) are FORBIDDEN. Within each service repository, domain modules MUST remain self-contained; cross-module access within the same service MUST happen exclusively through exported service providers via module index barrels (`index.ts`). Circular dependencies between modules are strictly forbidden.

### II. Polyrepo Architecture & Cross-Service Contracts
Each business domain MUST be built and deployed as an independent repository (`hrms-<domain>-service`). Cross-service interactions MUST use explicit, versioned contracts over REST (via OpenAPI/Swagger typed clients) or asynchronous Kafka events with versioned schemas. Direct database sharing or inter-service source code imports are FORBIDDEN. Each service owns its database/schema exclusively.

### III. TypeScript Rigor & Naming Standards
All TypeScript code MUST run under `strict: true` with zero usage of `any` (use `unknown` and narrow). Explicit return types are MANDATORY on all public API methods and exported functions. Code and file naming MUST strictly follow suffix-based kebab-case conventions (`<domain>.<type>.ts`) matching physical directory structures. Barrel exports (`index.ts`) MUST re-export public APIs only and avoid deep barrel creation inside `dto/` or `entities/`.

### IV. Testing Discipline & Quality Gates
All business logic MUST be covered by unit tests (minimum 90% statement/function coverage, 85% branch coverage enforced in CI). Tests MUST follow the Arrange-Act-Assert (AAA) pattern. Repositories and database interactions MUST be tested against real PostgreSQL instances via Testcontainers (no mocking database engines for query correctness tests). CI pipelines MUST enforce linting, formatting, type-checking, and test coverage before merging.

### V. Database Integrity, Transactions & Migrations
Database schemas MUST extend `BaseEntity` (providing UUID primary keys, soft-delete `deletedAt`, audit timestamps, and `@VersionColumn()` optimistic locking where concurrent updates occur). Multi-statement atomic operations MUST be wrapped in explicit service-level transactions. Schema changes MUST be executed exclusively via TypeORM migrations under `src/migrations/` with mandatory `down()` rollback functions (`synchronize: true` is forbidden outside local sandboxes). Foreign keys and query filter columns MUST be indexed.

### VI. Security, Authentication & Observability
Authentication MUST use asymmetric JWT RS256 signing (public key verification across microservices). Role-Based Access Control (RBAC) MUST be declared at controller boundaries via `@Permissions()` decorators and enforced by `PermissionGuard`. All raw input MUST be validated with `class-validator` DTOs with strict whitelisting. Logging MUST be structured JSON via `AppLogger` carrying `requestId`, `tenantCode`, and correlation context.

### VII. Performance, Caching & Scalability
List endpoints MUST implement cursor or offset pagination via `libs-sql`. N+1 queries are review blockers and strictly prohibited; explicit join select projections MUST be used instead of `select *`. Caching MUST be routed through `CacheManager` with explicit TTLs for read-heavy master data, sessions, and permissions only—mutable transactional entities MUST NEVER be cached without write-through invalidation. Bulk write operations MUST use batching or queue-backed workers.

## Technology Stack & Infrastructure

The project standardized on the following core tech stack:
- **Framework & Language**: NestJS (latest), TypeScript (`strict: true`), pnpm package manager.
- **Data & Persistence**: PostgreSQL (ACID relational), TypeORM, Redis (via `CacheManager`).
- **Communication & Integration**: RESTful APIs (versioned), OpenAPI/Swagger, Kafka (asynchronous event messaging).
- **Containerization & Deployment**: Docker (immutable images), Kubernetes (declarative orchestration).
- **Tooling & Quality**: ESLint, Prettier, Husky, Commitlint (Conventional Commits format).
- **Shared Libraries**: `@hrms/libs-core`, `@hrms/libs-sql`, `@hrms/libs-apis` consumed as versioned npm packages.

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
- **Compliance & PR Reviews**: All pull requests MUST be verified for compliance against this Constitution and the accompanying `coding-conventions.md`, `implementation-rules.md`, `tech-stack.md`, `testing-strategy.md`, and `repository-structure.md`.
- **Amendments**: Amendments to this Constitution require formal review, rationale documentation, and a version bump:
  - **MAJOR**: Structural governance or principle redefinitions / removals.
  - **MINOR**: Addition of new principles or significant structural guidance expansion.
  - **PATCH**: Non-semantic clarifications, typo fixes, or wording updates.

**Version**: 2.0.0 | **Ratified**: 2026-08-08 | **Last Amended**: 2026-08-08
