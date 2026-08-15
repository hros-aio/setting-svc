# Research & Technical Decisions: Company Initialization at Tenant Provisioning

## 1. Event Subscription & Cross-Service Topic Alignment

### Decision
Subscribe to Kafka topic `tenant.lifecycle-events` for event type `tenant.created` (with `tenant.provisioned` supported as an alias). Standardize payload ingestion using `@new-hros/libs-events` `EventEnvelope<T>` pattern.

### Rationale
- `auth-svc` ([`TenantProvisioningConsumer`](file:///home/ren0503/new-hros/admin-module/auth-svc/src/kafka/consumers/tenant-provisioning.consumer.ts)) already listens to `tenant.lifecycle-events` for `tenant.created` to bootstrap the root administrator.
- Reusing the same topic and event envelope ensures architectural consistency across the HRMS admin module microservices.
- Supporting `tenant.provisioned` as a secondary match prevents regressions if upstream producers transition event names.

### Alternatives Considered
- Dedicated topic `setting.tenant-provisioning`: Rejected because upstream tenant service broadcasts generic lifecycle events to all interested microservices on `tenant.lifecycle-events`.
- Synchronous REST hook from Tenant Service: Rejected because provisioning is an asynchronous distributed workflow that must be resilient to transient downtime.

---

## 2. Distributed Deduplication & Idempotency Strategy

### Decision
Implement dual-layer idempotency:
1. **Application / Persistence Layer**: A `consumed_events` table tracking `(event_id, topic, created_at)` checked and written within the same database transaction as the tenant and company entities.
2. **Database Constraints**: Multi-column unique constraints `uq_companies_tenant_code` and existence checks on `tenants.tenant_id` / `tenants.tenant_code`.

### Rationale
- Guarantees exactly-once processing semantics even under concurrent Kafka re-deliveries or retry storms.
- Avoids partial writes: if an event is re-delivered after a crash, checking `consumed_events` allows an immediate no-op exit (`{ success: true, reason: 'DUPLICATE' }`).
- Matching the pattern in `auth-svc` (`ConsumedEventRepository`).

### Alternatives Considered
- Pure Redis-only deduplication: Rejected because Redis is runtime cache infrastructure and volatile; database transactional persistence is required for authoritative ACID idempotency.

---

## 3. Mandatory 8-Step Seeding Implementation

### Decision
Implement `SetupStepSeederService` to insert the 8 mandatory setup steps inside the active entity transaction with fixed sequential order (1 to 8) and `INCOMPLETE` status:
1. `COMPANY_INFORMATION` (order: 1)
2. `LOCATION` (order: 2)
3. `DEPARTMENT` (order: 3)
4. `GRADE` (order: 4)
5. `JOB_TITLE` (order: 5)
6. `ROLE` (order: 6)
7. `EMPLOYEE_IMPORT` (order: 7)
8. `POC` / `ORGANIZATION_RESPONSIBILITY` (order: 8)

### Rationale
- Aligns directly with `SetupStepType` domain enum in `setting-svc` (`src/common/enums/domain-enums.ts`) and Constitution Section Operational Architecture §1.
- Guarantees that no company can transition from `PENDING` to `ACTIVE` without completing each sequential milestone.

### Alternatives Considered
- Lazy-creating setup steps on demand: Rejected because governance requires a complete, queryable checklist from the moment a company is provisioned.

---

## 4. Transactional Outbox Pattern for Downstream Events

### Decision
Persist a `company.created` event into `outbox_events` within the same database transaction as the company creation.

### Rationale
- Satisfies Constitution Principle II (Polyrepo Architecture & Cross-Service Contracts) and Transactional Outbox requirements.
- Guarantees zero distributed 2PC transaction overhead while ensuring guaranteed eventual event emission.

### Alternatives Considered
- Direct Kafka publish during request handling: Rejected because network failure could cause the database write to commit while Kafka publish fails, or vice versa (dual-write hazard).
