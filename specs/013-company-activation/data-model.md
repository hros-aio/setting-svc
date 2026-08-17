# Data Model: Company Activation

## Entities & Relationships

### 1. `CompanyEntity` (`companies`)

Represents the core organization/company entity within a tenant.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | NO | Primary key |
| `tenant_id` | `uuid` | NO | Foreign key to `tenants.id` |
| `company_code` | `varchar(50)` | NO | Unique company identifier within tenant |
| `legal_name` | `varchar(255)` | NO | Official registered legal name |
| `display_name` | `varchar(255)` | NO | Display name in UI |
| `status` | `varchar(20)` | NO | `PENDING` -> `ACTIVE` (Terminal in setup context) |
| `is_template` | `boolean` | NO | Template company designation flag |
| `registration_number` | `varchar(100)` | YES | Business registration number |
| `tax_registration_number` | `varchar(100)` | YES | Tax registration number |
| `country_code` | `varchar(2)` | YES | ISO country code |
| `currency_code` | `varchar(3)` | YES | Currency code |
| `timezone` | `varchar(50)` | YES | Timezone identifier |
| `locale` | `varchar(10)` | YES | Default locale |
| `legal_address` | `jsonb` | YES | Structured address object |
| `information_completed_at` | `timestamptz` | YES | Timestamp when Step 1 was completed |
| `information_completed_by` | `uuid` | YES | User who completed Step 1 |
| `activated_at` | `timestamptz` | YES | Timestamp when company was activated |
| `activated_by` | `uuid` | YES | User ID who performed activation |
| `created_at` | `timestamptz` | NO | Creation audit timestamp |
| `updated_at` | `timestamptz` | NO | Update audit timestamp |

### 2. `CompanySetupStepEntity` (`company_setup_steps`)

Tracks onboarding progress for all 8 mandatory setup steps.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | NO | Primary key |
| `tenant_id` | `uuid` | NO | Scoped tenant ID |
| `company_id` | `uuid` | NO | Foreign key to `companies.id` |
| `step_type` | `varchar(50)` | NO | Enum of 8 mandatory step types |
| `step_order` | `int` | NO | Sequence order (1 to 8) |
| `status` | `varchar(20)` | NO | `INCOMPLETE` or `COMPLETED` |
| `completed_at` | `timestamptz` | YES | Completion timestamp |
| `completed_by` | `uuid` | YES | Completing user ID |
| `external_reference_id` | `varchar(255)` | YES | External batch/event reference |
| `metadata` | `jsonb` | YES | Metadata payload |

### 3. `OutboxEventEntity` (`outbox_events`)

Ensures reliable transactional emission of domain events.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | NO | Primary key |
| `aggregate_type` | `varchar(50)` | NO | `'company'` |
| `aggregate_id` | `uuid` | NO | `company_id` |
| `event_type` | `varchar(100)` | NO | `'company.activated'` |
| `payload` | `jsonb` | NO | Serialized event payload |
| `status` | `varchar(20)` | NO | `PENDING` |
| `created_at` | `timestamptz` | NO | Creation timestamp |

---

## State Transition Rules

```
                      ┌────────────────────────────────────────┐
                      │                PENDING                 │
                      └──────────────────┬─────────────────────┘
                                         │
                                         │ Explicit POST /companies/:id/activate
                                         │ (Only if ALL 8 steps are COMPLETED)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │                 ACTIVE                 │
                      └────────────────────────────────────────┘
```

- **PENDING -> ACTIVE**: Permitted ONLY when all 8 mandatory steps have `status = 'COMPLETED'`.
- **ACTIVE -> PENDING / Re-activation**: Strictly FORBIDDEN. If already `ACTIVE`, throws `CompanyAlreadyActiveException` (HTTP 422 or 409).
