# Data Model: Company Initialization at Tenant Provisioning (Simplified)

## Entities and Relationships

```
┌──────────────────────────┐
│       tenants            │
├──────────────────────────┤
│ id (PK, UUID)            │
│ tenant_id (UUID, Unique) │
│ tenant_code (VARCHAR)    │
│ name (VARCHAR)           │
│ source_version (BIGINT)  │
│ created_at / updated_at  │
└────────────┬─────────────┘
             │ 1
             │
             │ *
┌────────────▼─────────────┐          1 ┌──────────────────────────┐
│      companies           │───────────►│   company_setup_steps    │
├──────────────────────────┤            ├──────────────────────────┤
│ id (PK, UUID)            │ *          │ id (PK, UUID)            │
│ tenant_id (FK, UUID)     │            │ tenant_id (FK, UUID)     │
│ company_code (VARCHAR)   │            │ company_id (FK, UUID)    │
│ legal_name (VARCHAR)     │            │ step_type (ENUM, 8 steps)│
│ display_name (VARCHAR)   │            │ step_order (1..8)        │
│ status ('pending'|'active')           │ status ('incomplete'|..) │
│ is_template (BOOLEAN)    │            │ completed_at / by        │
│ country_code (CHAR(2))   │            │ metadata (JSONB)         │
│ currency_code (CHAR(3))  │            └──────────────────────────┘
│ timezone (VARCHAR)       │
│ created_at / updated_at  │
└──────────────────────────┘

┌──────────────────────────┐
│      outbox_events       │
├──────────────────────────┤
│ id (PK, UUID)            │
│ aggregate_type (VARCHAR) │
│ aggregate_id (VARCHAR)   │
│ event_type (VARCHAR)     │
│ payload (JSONB)          │
│ status ('pending'|..)    │
│ created_at (TIMESTAMPTZ) │
└──────────────────────────┘
```

## Entity Details

### 1. `tenants` (Read-only Projection)
- `id` (UUID, PK)
- `tenant_id` (UUID, Unique, Non-nullable): Upstream tenant UUID
- `tenant_code` (VARCHAR(64), Unique, Non-nullable): Upstream human-readable code
- `name` (VARCHAR(255), Non-nullable): Tenant / Organization name
- `source_version` (BIGINT, Default: 0): Sequence / version of the upstream event
- `created_at` / `updated_at` (TIMESTAMPTZ)

### 2. `companies`
- `id` (UUID, PK)
- `tenant_id` (UUID, FK -> `tenants.id`)
- `company_code` (VARCHAR(64), Non-nullable): Auto-generated from `tenant_code` (e.g. `<TENANT_CODE>_HQ`)
- `legal_name` (VARCHAR(255), Non-nullable)
- `display_name` (VARCHAR(255), Nullable)
- `status` (ENUM: `pending`, `active`, Default: `pending`)
- `is_template` (BOOLEAN, Default: `true` for initial default company)
- `country_code` (CHAR(2), Nullable)
- `currency_code` (CHAR(3), Nullable)
- `timezone` (VARCHAR(64), Default: `'UTC'`)
- Constraints:
  - `uq_companies_tenant_code`: Unique on `(tenant_id, company_code)`
  - `uq_companies_one_template_per_tenant`: Unique on `(tenant_id)` WHERE `is_template = true`
  - `ck_companies_activation_state`: `(status = 'pending' AND activated_at IS NULL) OR (status = 'active' AND activated_at IS NOT NULL)`

### 3. `company_setup_steps`
- `id` (UUID, PK)
- `tenant_id` (UUID, FK -> `tenants`)
- `company_id` (UUID, FK -> `companies`)
- `step_type` (ENUM `setup_step_type`):
  1. `company_information`
  2. `location`
  3. `department`
  4. `grade`
  5. `job_title`
  6. `role`
  7. `employee_import`
  8. `poc`
- `step_order` (SMALLINT, 1 to 8)
- `status` (ENUM `setup_step_status`: `incomplete`, `completed`, Default: `incomplete`)
- `completed_at` (TIMESTAMPTZ, Nullable)
- `completed_by` (UUID, Nullable)
- `metadata` (JSONB, Default: `{}`)
- Constraints:
  - `uq_company_setup_step`: Unique on `(company_id, step_type)`
  - `uq_company_setup_order`: Unique on `(company_id, step_order)`
  - `ck_company_setup_order`: `step_order BETWEEN 1 AND 8`

## State Transitions & Idempotency Flow

```
[tenant.created Event]
        │
        ▼
  Start Database Transaction
        ├── Upsert Tenant Projection
        ├── Check if template company exists for tenant:
        │     companies(tenant_id, is_template = true)
        │     └── If exists ──► Exit gracefully (Idempotent 200 OK)
        │
        ├── Auto-generate company_code (e.g. <TENANT_CODE>_HQ)
        ├── Insert Company (status: 'pending', is_template: true)
        ├── Seed 8 Company Setup Steps (status: 'incomplete', orders 1..8)
        └── Insert Outbox Event ('company.created')
        │
        ▼
  Commit Transaction
```
