# Data Model: Multi-Company Isolation

**Feature**: Multi-Company Isolation  
**Date**: 2026-08-18  
**Status**: Completed  

---

## 1. Domain Entities & Database Constraints

All organizational master data entities exist within a strict hierarchical ownership model: `Tenant` → `Company` → `Master Data Entities`.

```
┌─────────────────────────────────────────────────────────────┐
│                           Tenant                            │
│  (id, tenant_id, tenant_code, name)                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ 1:N
┌──────────────────────────────▼──────────────────────────────┐
│                          Company                            │
│  (id, tenant_id, company_code, legal_name, status)          │
│  CONSTRAINT: UNIQUE (tenant_id, company_code)               │
└──────┬───────────────────────┬───────────────────────┬──────┘
       │ 1:N                   │ 1:N                   │ 1:N
┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
│  Location   │         │ Department  │         │    Grade    │
│ (company_id,│         │ (company_id,│         │ (company_id,│
│  code)      │         │  code)      │         │  code)      │
│  UNIQUE     │         │  UNIQUE     │         │  UNIQUE     │
└─────────────┘         └──────┬──────┘         └──────┬──────┘
                               │                       │
                               │ 1:N                   │ 1:N
                        ┌──────▼───────────────────────▼──────┐
                        │              Job Title              │
                        │ (company_id, department_id,         │
                        │  grade_id, code)                    │
                        │ CONSTRAINT: UNIQUE (company_id,     │
                        │                     code)           │
                        └─────────────────────────────────────┘
```

---

## 2. Table Schemas & Isolation Constraints

### 2.1 Locations Table (`locations`)
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary Key (UUIDv7) |
| `tenant_id` | `uuid` | No | Foreign Key to `tenants(id)` |
| `company_id` | `uuid` | No | Foreign Key to `companies(id)` |
| `code` | `varchar(64)` | No | Business location code |
| `name` | `varchar(255)` | No | Display name |
| `is_headquarter` | `boolean` | No | Headquarter flag |
| `status` | `master_data_status` | No | `scheduled` \| `active` \| `inactive` |
| `effective_at` | `timestamptz` | No | Effective transition timestamp |

**Isolation Constraints & Indexes**:
- `CONSTRAINT uq_locations_company_code UNIQUE (company_id, code)`
- `CREATE INDEX idx_locations_company_status ON locations (company_id, status)`
- `CREATE UNIQUE INDEX uq_locations_one_headquarter_per_company ON locations (company_id) WHERE is_headquarter = true AND status <> 'inactive'`

---

### 2.2 Departments Table (`departments`)
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary Key (UUIDv7) |
| `tenant_id` | `uuid` | No | Foreign Key to `tenants(id)` |
| `company_id` | `uuid` | No | Foreign Key to `companies(id)` |
| `code` | `varchar(64)` | No | Business department code |
| `name` | `varchar(255)` | No | Display name |
| `parent_department_id` | `uuid` | Yes | Foreign Key to `departments(id)` |
| `status` | `master_data_status` | No | `scheduled` \| `active` \| `inactive` |
| `effective_at` | `timestamptz` | No | Effective transition timestamp |

**Isolation Constraints & Indexes**:
- `CONSTRAINT uq_departments_company_code UNIQUE (company_id, code)`
- `CONSTRAINT ck_departments_not_self_parent CHECK (parent_department_id IS NULL OR parent_department_id <> id)`
- `CREATE INDEX idx_departments_company_status ON departments (company_id, status)`

---

### 2.3 Grades Table (`grades`)
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary Key (UUIDv7) |
| `tenant_id` | `uuid` | No | Foreign Key to `tenants(id)` |
| `company_id` | `uuid` | No | Foreign Key to `companies(id)` |
| `code` | `varchar(64)` | No | Business grade code |
| `name` | `varchar(255)` | No | Grade display name |
| `rank_order` | `integer` | Yes | Numeric ranking order |
| `source_grade_id` | `uuid` | Yes | Informational trace for copied templates |
| `status` | `master_data_status` | No | `scheduled` \| `active` \| `inactive` |
| `effective_at` | `timestamptz` | No | Effective transition timestamp |

**Isolation Constraints & Indexes**:
- `CONSTRAINT uq_grades_company_code UNIQUE (company_id, code)`
- `CREATE INDEX idx_grades_company_status ON grades (company_id, status)`

---

### 2.4 Job Titles Table (`job_titles`)
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary Key (UUIDv7) |
| `tenant_id` | `uuid` | No | Foreign Key to `tenants(id)` |
| `company_id` | `uuid` | No | Foreign Key to `companies(id)` |
| `department_id` | `uuid` | No | Foreign Key to `departments(id)` |
| `grade_id` | `uuid` | No | Foreign Key to `grades(id)` |
| `code` | `varchar(64)` | No | Business job title code |
| `name` | `varchar(255)` | No | Job title display name |
| `status` | `master_data_status` | No | `scheduled` \| `active` \| `inactive` |
| `effective_at` | `timestamptz` | No | Effective transition timestamp |

**Isolation Constraints & Indexes**:
- `CONSTRAINT uq_job_titles_company_code UNIQUE (company_id, code)`
- `CREATE INDEX idx_job_titles_company_department ON job_titles (company_id, department_id)`
- `CREATE INDEX idx_job_titles_company_grade ON job_titles (company_id, grade_id)`
- `CREATE INDEX idx_job_titles_company_status ON job_titles (company_id, status)`

---

### 2.5 Points of Contact Table (`pocs`)
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary Key (UUIDv7) |
| `tenant_id` | `uuid` | No | Foreign Key to `tenants(id)` |
| `company_id` | `uuid` | No | Foreign Key to `companies(id)` |
| `poc_type` | `varchar(64)` | No | Functional role (e.g. `HR_HEAD`) |
| `employee_id` | `uuid` | No | Employee identifier from directory |
| `status` | `master_data_status` | No | `scheduled` \| `active` \| `inactive` |
| `effective_at` | `timestamptz` | No | Effective transition timestamp |

**Isolation Constraints & Indexes**:
- `CREATE UNIQUE INDEX uq_pocs_one_active_per_type ON pocs (company_id, poc_type) WHERE status <> 'inactive'`
- `CREATE INDEX idx_pocs_company_type ON pocs (company_id, poc_type, status)`
- `CREATE INDEX idx_pocs_employee ON pocs (tenant_id, employee_id)`

---

### 2.6 Effective Changes Table (`effective_changes`)
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary Key (UUIDv7) |
| `tenant_id` | `uuid` | No | Foreign Key to `tenants(id)` |
| `company_id` | `uuid` | No | Foreign Key to `companies(id)` |
| `entity_type` | `varchar(64)` | No | `location` \| `department` \| `grade` \| `job_title` \| `poc` |
| `entity_id` | `uuid` | No | Entity primary key |
| `operation` | `change_operation` | No | `create` \| `update` \| `deactivate` |
| `effective_at` | `timestamptz` | No | Scheduled execution date |
| `status` | `effective_change_status` | No | `scheduled` \| `processing` \| `applied` \| `cancelled` \| `failed` |
| `payload` | `jsonb` | No | Scheduled delta state |

**Isolation Constraints & Indexes**:
- `CREATE UNIQUE INDEX uq_effective_changes_one_pending_per_entity ON effective_changes (company_id, entity_type, entity_id) WHERE status IN ('scheduled', 'processing')`
- `CREATE INDEX idx_effective_changes_company ON effective_changes (company_id, status, effective_at)`

---

## 3. Domain Invariant Rules

1. **INV-001 (Company Code Scoping)**: Two records in the same master table may share the exact same `code` if and only if their `company_id` values differ.
2. **INV-002 (Job Title Boundary Invariant)**: For any `JobTitle` record:
   - `department.company_id === jobTitle.company_id`
   - `grade.company_id === jobTitle.company_id`
   - `department.tenant_id === jobTitle.tenant_id`
   - `grade.tenant_id === jobTitle.tenant_id`
3. **INV-003 (Department Hierarchy Boundary Invariant)**: For any `Department` record with `parent_department_id`:
   - `parentDepartment.company_id === department.company_id`
   - `parentDepartment.tenant_id === department.tenant_id`
4. **INV-004 (PoC Employee Tenant Invariant)**: For any `PoC` assignment:
   - `employeeReference.tenant_id === poc.tenant_id`
   - Individual employee may hold PoCs across multiple sibling companies, but each PoC row is strictly isolated to its respective `company_id`.
5. **INV-005 (Repository Scoping Invariant)**: Every repository read/write query MUST include `tenant_id = :tenantId AND company_id = :companyId`. Queries failing to provide company context are prohibited for company-owned entities.
