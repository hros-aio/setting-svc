# Research: Init Setting Service Infrastructure

## 1. Global Route Prefix Configuration in NestJS

### Decision
Configure the global URI route prefix as `setting-api` in `main.ts` using `app.setGlobalPrefix('setting-api')`.

### Rationale
- Strictly fulfills FR-001 and SC-002 requirements specified in `spec.md`.
- Ensures all REST endpoints (including system endpoints and Swagger specs) are mounted under `http://<host>:<port>/setting-api`.
- Excludes health check route or includes health under prefix per standard gateway routing rules (`/setting-api/health`).

### Alternatives Considered
- Direct Nginx/Ingress path rewriting without application global prefix: Rejected because in-app routing guarantees self-contained testability and consistency across environments.

---

## 2. Infrastructure Integration Patterns for PostgreSQL and Redis

### Decision
- **PostgreSQL**: Use TypeORM Module (`TypeOrmModule.forRootAsync()`) consuming shared connection configuration patterns from `@hrms/libs-sql`.
- **Redis**: Inject shared `CacheManager` provider from `@hrms/libs-core` with default namespacing (`setting-svc:<entity>:<id>`).

### Rationale
- Complies with Principle V (Database Integrity) and Principle VII (Performance, Caching & Scalability) of the project constitution.
- Ensures zero raw Redis client usage and enforces TypeORM connection management with pooling.

### Alternatives Considered
- Direct `ioredis` initialization: Rejected by constitution (Principle VII).
- Synchronous TypeORM configuration: Rejected to enable dynamic async loading from environment variables.

---

## 3. Health Check & Graceful Shutdown Strategy

### Decision
- Implement `@nestjs/terminus` or a lightweight native health indicator service under `src/modules/health/health.controller.ts` exposing `/setting-api/health`.
- Enable NestJS shutdown hooks (`app.enableShutdownHooks()`) in `main.ts` to capture `SIGTERM` and `SIGINT` signals for connection pool draining.

### Rationale
- Meets FR-005, FR-006, SC-003, and SC-004 requirements.
- Guarantees zero dangling PostgreSQL database handles or unclosed Redis sockets during Kubernetes pod rotation.

### Alternatives Considered
- Unhandled exit process (`process.exit(0)`): Rejected due to resource leak risks in high-traffic microservice environments.
