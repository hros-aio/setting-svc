# Implementation Plan: Company Initialization at Tenant Provisioning

**Branch**: `003-company-init-provisioning` | **Date**: 2026-08-15 | **Status**: Planned

## Summary
Implement automated company bootstrapping upon tenant creation in `setting-svc`. The service subscribes to `tenant.lifecycle-events` for `tenant.created` events, coordinates an atomic database transaction using `@new-hros/libs-sql`'s `TransactionService`, establishes a tenant reference projection, initializes exactly one initial `Company` in `PENDING` status, seeds the 8 mandatory `company_setup_steps` in `INCOMPLETE` status, records event deduplication in `consumed_events`, and queues a `company.created` event in the Transactional Outbox.

## Technical Context
- **Language/Framework**: NestJS, TypeScript (`strict: true`)
- **Database/ORM**: PostgreSQL, TypeORM
- **Messaging**: Kafka (`@nestjs/microservices`, `@new-hros/libs-events`), topic `tenant.lifecycle-events`
- **Shared Libraries**: `@new-hros/libs-core`, `@new-hros/libs-sql`, `@new-hros/libs-events`
- **Transactions & Idempotency**: `TransactionService.runInTransaction`, `ConsumedEventRepository`

## Constitution Check
- [x] **Principle I: Clean Architecture**: Controller (`TenantProvisioningConsumer`) → Service (`ProvisioningApplicationService` / `CompanyProvisioningService`, `SetupStepSeederService`) → Repository (`CompanyRepository`, `TenantRepository`, `CompanySetupStepRepository`, `ConsumedEventRepository`).
- [x] **Principle II: Polyrepo Architecture & Contracts**: Event-driven ingestion over Kafka using `@new-hros/libs-events`; isolated database ownership.
- [x] **Principle III: TypeScript Rigor**: Strict typing with explicit return types and kebab-case file conventions.
- [x] **Principle IV: Testing Quality**: AAA tests covering edge cases, idempotency, and transactional rollbacks.
- [x] **Principle V: Database Integrity & Transactions**: Atomic single-transaction wrap with rollback on any failure; strict foreign keys and unique constraints.
- [x] **Operational & Domain Architecture §1**: Initial status is strictly `PENDING`; exactly 8 mandatory setup steps seeded sequentially in `INCOMPLETE` status.

## Architecture & Module Structure

```
src/
├── common/
│   └── enums/
│       └── domain-enums.ts
├── kafka/
│   └── consumers/
│       ├── index.ts
│       └── tenant-provisioning.consumer.ts
└── modules/
    ├── company/
    │   ├── commands/
    │   │   └── initialize-company.command.ts
    │   ├── entities/
    │   │   ├── company.entity.ts
    │   │   └── company-setup-step.entity.ts
    │   ├── repositories/
    │   │   ├── company.repository.ts
    │   │   └── company-setup-step.repository.ts
    │   ├── services/
    │   │   ├── company-provisioning.service.ts
    │   │   └── setup-step-seeder.service.ts
    │   └── company.module.ts
    ├── tenant/
    │   ├── entities/
    │   │   └── tenant.entity.ts
    │   ├── repositories/
    │   │   └── tenant.repository.ts
    │   └── tenant.module.ts
    └── provisioning/
        ├── entities/
        │   └── consumed-event.entity.ts
        ├── repositories/
        │   └── consumed-event.repository.ts
        └── provisioning.module.ts
```

## Step-by-Step Implementation Strategy

### Phase 1: Repositories & Entities Scaffolding
1. Create `ConsumedEvent` entity and `ConsumedEventRepository` under `src/modules/provisioning` (or `src/common/events`).
2. Implement repository data access methods for `CompanyRepository`, `CompanySetupStepRepository`, and `TenantRepository`.

### Phase 2: Setup Step Seeder & Provisioning Domain Logic
1. Implement `SetupStepSeederService` to persist the 8 mandatory steps with order 1..8 and status `INCOMPLETE`.
2. Implement `CompanyProvisioningService` (or command handler) wrapping:
   - Event idempotency check via `consumed_events`
   - Tenant existence / projection upsert
   - Company creation (`status = 'PENDING'`, `is_template = false`)
   - Setup step seeder invocation
   - Outbox event persistence (`company.created`)
   - Consumed event persistence (`consumed_events`)
   - All inside `TransactionService.runInTransaction`

### Phase 3: Kafka Consumer Ingestion
1. Implement `TenantProvisioningConsumer` subscribing to `@EventPattern('tenant.lifecycle-events')`.
2. Handle event matching for `tenant.created` and `tenant.provisioned`.
3. Wrap execution in `RequestContextService.run` carrying `traceId`, `tenantCode`, etc.
4. Integrate consumer into `AppModule` / `KafkaModule`.

### Phase 4: Unit & Integration Testing
1. Unit tests for `SetupStepSeederService` and `CompanyProvisioningService`.
2. Unit tests for `TenantProvisioningConsumer` error handling and deduplication.
3. Transactional rollback tests proving zero partial records on failure.
