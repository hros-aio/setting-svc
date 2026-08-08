# Technical Stack

Enterprise HRMS Backend

---

## 1. Stack Overview

| Layer | Technology | Why |
|---|---|---|
| Backend framework | **NestJS** (latest) | Opinionated, modular architecture with first-class DI, decorators, and a module system that maps cleanly onto domain-driven boundaries — reduces architectural drift across a large team compared to an unopinionated Express/Koa base. |
| Language | **TypeScript** | Static typing catches contract violations (DTO shape, entity fields, service signatures) at compile time, which matters at HRMS scale where payroll/leave/compliance logic must not silently break. |
| Database | **PostgreSQL** | Mature relational engine with strong transactional guarantees (ACID), rich indexing (partial, composite, GIN/GIST), and native support for the constraints an HRMS needs (uniqueness, foreign keys, row-level locking for payroll runs). |
| ORM | **TypeORM** | Native NestJS integration, decorator-based entities matching the framework's style, migration tooling, and repository pattern support that pairs directly with `libs-sql`'s `BaseRepository`. |
| Cache | **Redis** | Sub-millisecond reads for session/permission lookups and master data, offloading read pressure from PostgreSQL for the cacheable subset defined in `implementation-rules.md`. |
| Authentication | **JWT (RS256)** | Asymmetric signing lets the auth service hold the private key while every other service verifies with the public key only — no shared secret to rotate across services, and tokens are stateless-verifiable at the API gateway or any service. |
| API documentation | **Swagger / OpenAPI** | Generated directly from decorators on controllers/DTOs, keeping documentation guaranteed in sync with the actual contract, and gives frontend/integration teams a browsable, testable spec. |
| Validation | **class-validator** + **class-transformer** | Declarative, decorator-based validation co-located with the DTO definition; integrates natively with Nest's `ValidationPipe` for automatic request rejection before it reaches business logic. |
| API style | **RESTful APIs** | Predictable resource-oriented contracts, wide client/tooling support, and a natural fit for Swagger-driven documentation and HTTP-native concerns (caching headers, status codes, versioning by URI). |
| Containerization | **Docker** | Consistent runtime across local, CI, and production; every service ships as an immutable image. |
| Orchestration | **Kubernetes** | Declarative scaling, rolling deployments, health-check-driven self-healing, and config/secret management appropriate for a multi-service, multi-tenant HRMS at production scale. |
| Linting | **ESLint** | Enforces the conventions in `coding-conventions.md` automatically (naming, import order, no-any, etc.), catching violations before review. |
| Formatting | **Prettier** | Removes formatting bikeshedding from code review; runs as an ESLint-integrated, pre-commit-enforced step. |
| Git hooks | **Husky** | Runs lint/format/commit-message checks locally before code reaches CI, shortening feedback loops. |
| Commit linting | **Commitlint** | Enforces Conventional Commits at commit time, enabling automated changelog generation and clear PR history. |
| Package manager | **pnpm** | Fast, disk-efficient installs and strict, non-hoisted `node_modules` that catches phantom dependencies — important in a monorepo with multiple `libs-*` packages that must declare their own dependencies explicitly. |

## 2. Backend — NestJS

Chosen for its modular, decorator-driven architecture, native dependency injection, and ecosystem alignment with TypeScript. It provides the structural backbone (`@Module`, `@Injectable`, `@Controller`, guards, interceptors, pipes) that `coding-conventions.md` and `implementation-rules.md` build on directly, and its monorepo/library support is what makes `libs-core`/`libs-sql`/`libs-apis` viable as first-class shared packages rather than copy-pasted utilities.

## 3. Database — PostgreSQL + TypeORM

PostgreSQL is chosen over NoSQL alternatives because HRMS data is inherently relational (employees ↔ departments ↔ locations ↔ leave balances ↔ payroll runs) with strict referential integrity and transactional requirements (a payroll run must not partially commit). TypeORM is chosen over Prisma/Sequelize for its decorator-based entity style (consistent with Nest's overall decorator idiom), active-record-free repository pattern (fits the `BaseRepository` abstraction in `libs-sql`), and mature migration tooling.

## 4. Cache — Redis

Used strictly for the cacheable categories defined in `implementation-rules.md §4` (sessions, permissions, master data). Chosen for its predictable low-latency reads, TTL-native expiry model, and wide operational familiarity for the ops team running the Kubernetes cluster.

## 5. Authentication — JWT RS256

RS256 (asymmetric) is chosen over HS256 (symmetric) specifically because the HRMS backend is composed of multiple services: only the auth service needs the private signing key, while every other service (and API gateway) can verify tokens with a distributed public key, with no shared-secret distribution/rotation problem.

## 6. Documentation — Swagger

Chosen because it's generated from the same decorators that define validation and routing, so the spec cannot drift silently from the implementation the way a hand-maintained document would.

## 7. Validation — class-validator / class-transformer

Chosen for native NestJS `ValidationPipe` integration, letting validation rules live directly on the DTO as decorators rather than in separate schema files, keeping the contract and its constraints in one place.

## 8. Infrastructure — Docker & Kubernetes

Docker guarantees environment parity from a developer's laptop through CI to production. Kubernetes is chosen for horizontal scaling of stateless API pods, rolling/zero-downtime deployments, liveness/readiness-probe-driven self-healing, and namespace-based multi-environment isolation — all standard requirements for an enterprise system with uptime SLAs.

## 9. Code Quality — ESLint, Prettier, Husky, Commitlint

Together these four form the automated quality gate: ESLint enforces architectural and naming rules, Prettier removes formatting debate, Husky ensures both run before a commit even leaves a developer's machine, and Commitlint enforces a consistent, machine-parseable commit history.

## 10. Commit Message Convention — Conventional Commits

All commits follow [Conventional Commits](https://commitlint.js.org), enforced by Commitlint via a Husky `commit-msg` hook.

Format: `<type>(<scope>): <short description>`

| Type | Use for |
|---|---|
| `feat` | A new feature (new endpoint, new module, new business capability) |
| `fix` | A bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature (restructuring, renaming, extracting) |
| `docs` | Documentation-only changes (including these guideline files) |
| `style` | Formatting-only changes with no code logic impact (whitespace, semicolons) — rare, since Prettier handles this automatically |
| `test` | Adding or correcting tests only |
| `perf` | A code change that improves performance |
| `ci` | Changes to CI configuration/pipelines |
| `chore` | Maintenance tasks that don't modify src or test files (dependency bumps, tooling config) |
| `build` | Changes affecting the build system or external dependencies (pnpm, Docker, tsconfig) |
| `revert` | Reverts a previous commit |

Examples:

```
feat(employee): add bulk import endpoint
fix(leave): correct balance calculation for half-day requests
refactor(payroll): extract tax calculation into strategy provider
docs: update repository-structure.md with recruitment module
build(deps): bump typeorm to 0.3.21
```

Scope is the domain module or library name (`employee`, `leave`, `libs-sql`, etc.). Breaking changes are marked with `!` after the type/scope (`feat(auth)!: change JWT payload shape`) and include a `BREAKING CHANGE:` footer.