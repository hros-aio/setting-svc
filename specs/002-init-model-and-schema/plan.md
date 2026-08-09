# Implementation Plan - HRMS Setting Service Domain Model & Schema

**User Goal**: Initialize the domain specification and design model for HRMS Setting Service based strictly on `schema.sql` and NestJS TypeScript domain representation.

## Technical Context

- **Primary Source**: `schema.sql` (PostgreSQL 18 DDL)
- **TypeScript & Code Model**: NestJS TypeScript interfaces, TypeORM entity classes, `class-validator` DTOs, and enums matching domain tables (`Company`, `CompanySetupStep`, `Location`, `Department`, `Grade`, `JobTitle`, `PoC`, `EffectiveChange`).
- **Domain Boundaries**: Setting Service owns configuration/master-data domains. `Tenant` and `Employee` references are local projections.
- **Architecture**: Clean architecture layering (Controller $\rightarrow$ Service $\rightarrow$ Repository), event-driven outbox messaging, multi-tenant isolation via `tenant_id` and `company_id`.

## Constitution Check

- **Layering & Boundaries**: PASS (Clean architecture layering with exported TypeScript entities/DTOs).
- **Multi-Tenancy**: PASS (`tenant_id` and `company_id` required across all entities).
- **Testing & Quality**: PASS (Validation scenarios provided in `quickstart.md`).

## Implementation Phases

### Phase 0: Research & Decisions
- Document domain modeling, multi-tenancy rules, effective-date mechanics, and event outbox decisions in [`research.md`](./research.md).

### Phase 1: Design & Contracts
- Detailed schema, TypeScript interface, TypeORM entity class, and DTO specification in [`data-model.md`](./data-model.md).
- Outbox CloudEvents contracts and reference projections in [`contracts/events-and-contracts.md`](./contracts/events-and-contracts.md).
- PostgreSQL DDL validation scenarios in [`quickstart.md`](./quickstart.md).
- Updated agent context file [`AGENTS.md`](../../AGENTS.md).
