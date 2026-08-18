# Phase 1 Data Model: Organization Responsibility (Point of Contact) Management

## 1. Entities and Tables

### Point of Contact (`pocs`)
Represents an individual designated as a Point of Contact for an organizational functional responsibility within a specific Company.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `tenant_id` | UUID | NO | - | Multi-tenant isolation partition key |
| `company_id` | UUID | NO | - | Foreign Key referencing `companies.id` |
| `poc_type` | VARCHAR(64) | NO | - | Responsibility type (e.g. `HR_HEAD`, `FINANCE_HEAD`) |
| `employee_id` | UUID | NO | - | Identifier of the assigned employee |
| `status` | VARCHAR(32) | NO | `'scheduled'` | State: `scheduled`, `active`, `inactive` |
| `effective_at` | TIMESTAMPTZ | NO | - | Timestamp when assignment becomes effective |
| `created_by` | UUID | YES | NULL | Creator user ID |
| `updated_by` | UUID | YES | NULL | Last updater user ID |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Record last update timestamp |

**Indexes & Constraints**:
- Primary Key: `pk_pocs` on `(id)`
- Foreign Key: `fk_pocs_company` on `company_id` REFERENCES `companies(id)` ON DELETE CASCADE
- Foreign Key: `fk_pocs_tenant` on `tenant_id` REFERENCES `tenants(id)` ON DELETE RESTRICT
- Partial Unique Index: `uq_pocs_one_active_per_type` on `(company_id, poc_type) WHERE status <> 'inactive'`
- Lookup Index: `idx_pocs_tenant_company_status` on `(tenant_id, company_id, status)`
- Employee Lookup Index: `idx_pocs_employee_lookup` on `(tenant_id, employee_id)`

---

### Effective Changes (`effective_changes`)
Generic effective-dating engine ledger tracking pending mutations awaiting future scheduled execution.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `tenant_id` | UUID | NO | - | Tenant scope |
| `company_id` | UUID | NO | - | Company scope |
| `entity_type` | VARCHAR(64) | NO | - | Entity discriminator (`'poc'`) |
| `entity_id` | UUID | NO | - | Target PoC ID |
| `change_type` | VARCHAR(32) | NO | - | Mutation type: `CREATE`, `UPDATE`, `DEACTIVATE` |
| `payload` | JSONB | NO | - | Serialized payload (e.g., `{ "newEmployeeId": "uuid" }`) |
| `effective_at` | TIMESTAMPTZ | NO | - | Future execution schedule |
| `status` | VARCHAR(32) | NO | `'scheduled'` | `scheduled`, `processing`, `applied`, `cancelled`, `failed` |
| `created_by` | UUID | YES | NULL | Author user ID |
| `updated_by` | UUID | YES | NULL | Updater user ID |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Created timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Updated timestamp |

**Indexes & Constraints**:
- Partial Unique Index: `uq_effective_changes_one_pending_per_entity` on `(entity_type, entity_id) WHERE status IN ('scheduled', 'processing')`

---

### Read-Only Employee Reference Projection (`employee_references`)
Local read-only projection populated via Directory domain events.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | NO | Primary Key |
| `tenant_id` | UUID | NO | Tenant scope |
| `company_id` | UUID | NO | Company scope |
| `employee_id` | UUID | NO | Authoritative employee UUID |
| `employee_number` | VARCHAR(128) | NO | Employee code |
| `display_name` | VARCHAR(255) | YES | Full display name |
| `employment_status` | VARCHAR(64) | YES | Employment status (`ACTIVE`, `TERMINATED`, etc.) |

---

## 2. Enums and Domain Constants

```typescript
export enum PocType {
  COUNTRY_HEAD = 'COUNTRY_HEAD',
  HR_HEAD = 'HR_HEAD',
  FINANCE_HEAD = 'FINANCE_HEAD',
  IT_HEAD = 'IT_HEAD',
  PAYROLL_OWNER = 'PAYROLL_OWNER',
}

export enum PocEventType {
  POC_ASSIGNED = 'setting.poc.assigned',
  POC_REPLACED = 'setting.poc.replaced',
  POC_DEACTIVATED = 'setting.poc.deactivated',
}
```

---

## 3. State Lifecycle & Transitions

```
[Initial Creation Command]
         │
         ▼
    (SCHEDULED) ──────[ Go Worker / Kafka callback at effective_at ]─────► (ACTIVE)
                                                                               │
                                                   ┌───────────────────────────┴───────────────────────────┐
                                                   │                                                       │
                                   [ Replacement applied at effective_at ]               [ Deactivation applied at effective_at ]
                                                   │                                                       │
                                                   ▼                                                       ▼
                                              (INACTIVE)                                              (INACTIVE)
                                      (+ New assignment created/activated)
```
