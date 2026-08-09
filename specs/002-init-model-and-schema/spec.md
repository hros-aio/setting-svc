# Specification: Domain Model & Schema Specification for Setting Service

## 1. Service Overview

### Purpose
The **HRMS Setting Service** is the master-data configuration authority for a multi-tenant HRMS SaaS platform. It serves as the single source of truth for organizational structures, setup configurations, and reference entities required by all other downstream HRMS business services.

### Core Responsibilities
- **Tenant Configuration & Company Onboarding**: Managing tenant projections, company entities, company template configurations, and multi-step onboarding setup workflows (`company_setup_steps`).
- **Organizational Structure & Master Data**: Owning the master data lifecycle for `Location`, `Department`, `Grade`, `JobTitle`, and `Point of Contact (PoC)`.
- **Scheduled Effective-Date Processing**: Storing and executing future-dated changes (create, update, deactivate) through `effective_changes` and direct `status`/`effective_at` tracking on master entities.
- **Master Data Event Publication**: Emitting domain events when configuration master data changes so that other microservices can asynchronously update their local projections.
- **TypeScript Code Model**: Defining NestJS / TypeORM domain classes, interfaces, enums, and `class-validator` DTOs corresponding to database entities.

### Domain Boundaries & Explicit Exclusions
- **Directory & Employee Master Data**: Employee demographics, employment contracts, and profiles belong to Directory Service. Setting Service only stores read-only local projections (`employee_references`).
- **Role & Access Control System**: User permissions and roles belong to Identity/IAM Service. Setting Service only records setup step completion (`role`).
- **Audit Logging**: Comprehensive historical audit logs and change tracking belong to Log Service. Setting Service stores current/scheduled state and pending `effective_changes` records only.
- **Tenant Management**: Creation and core management of tenants belong to Tenant/Admin Service. Setting Service only stores local projections (`tenants`).

---

## Clarifications

### Session 2026-08-09
- Q: How would you like to define TypeScript interfaces and classes for the Setting Service domain entities? → A: Option A - Define TypeScript interfaces/types matching each schema entity and NestJS domain classes/TypeORM entities with validation DTOs in code.

---

## 2. Domain Model

### Entity: Tenant Reference (`tenants`)
- **Purpose**: Local read-projection of tenant reference data managed by Tenant/Admin Service.
- **Aggregate**: Tenant Reference Aggregate (Projection).
- **Tenant Scope**: Cross-tenant isolation anchor (represents the tenant boundary itself).
- **Company Scope**: Global to the Tenant (contains companies).
- **Identity**: System-generated `id` (UUIDv7), mapped to canonical `tenant_id` (UUID) and `tenant_code`.
- **Attributes**: `id`, `tenant_id`, `tenant_code`, `name`, `source_version`, `created_at`, `updated_at`.
- **Relationships**: Parent to `Company` entities.
- **Lifecycle**: Read-only projection updated asynchronously from external tenant lifecycle events.
- **Business Invariants**: Each tenant must have a unique `tenant_id` and `tenant_code`.
- **Persistence Constraints**: `PRIMARY KEY (id)`, `UNIQUE (tenant_id)`, `UNIQUE (tenant_code)`.
- **TypeScript Representation**: `ITenant` interface, `TenantEntity` TypeORM class, `CreateTenantDto`, `UpdateTenantDto`.

### Entity: Company (`companies`)
- **Purpose**: Organizational boundary inside a tenant, representing a legal entity or business unit.
- **Aggregate**: Company Aggregate Root.
- **Tenant Scope**: Tenant-scoped (`tenant_id`).
- **Company Scope**: Self-boundary.
- **Identity**: System-generated `id` (UUIDv7), code-identified by `(tenant_id, company_code)`.
- **Attributes**: `id`, `tenant_id`, `company_code`, `legal_name`, `display_name`, `status`, `is_template`, `registration_number`, `tax_registration_number`, `country_code`, `legal_address` (JSONB), `timezone`, `locale`, `currency_code`, `information_completed_at`, `information_completed_by`, `activated_at`, `activated_by`, `created_by`, `updated_by`, `created_at`, `updated_at`.
- **Relationships**:
  - Belongs to `Tenant Reference` (`tenant_id` FK RESTRICT).
  - Owns `Company Setup Step` child entities.
  - Parent container for `Location`, `Department`, `Grade`, `JobTitle`, `PoC`, `Effective Change`.
- **Lifecycle**: `pending` $\rightarrow$ `active`. Activation requires non-null `activated_at`.
- **Business Invariants**:
  - `company_code` must be unique per tenant.
  - At most one company per tenant can be designated as template (`is_template = true`).
  - Pending companies must not have `activated_at` timestamp. Active companies must have `activated_at`.
- **Persistence Constraints**: `PRIMARY KEY (id)`, `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`, `UNIQUE (tenant_id, company_code)`, Partial Unique Index `uq_companies_one_template_per_tenant`, `CHECK (ck_companies_activation_state)`.
- **TypeScript Representation**: `ICompany` interface, `CompanyEntity` TypeORM class, `CreateCompanyDto`, `UpdateCompanyDto`, `CompanyStatus` enum.

### Entity: Company Setup Step (`company_setup_steps`)
- **Purpose**: Tracks onboarding/configuration progress across 8 designated setup steps for a company.
- **Aggregate**: Company Aggregate (Child entity).
- **Tenant Scope**: Tenant-scoped (`tenant_id`).
- **Company Scope**: Company-scoped (`company_id`).
- **Identity**: System-generated `id` (UUIDv7), unique by `(company_id, step_type)` and `(company_id, step_order)`.
- **Attributes**: `id`, `tenant_id`, `company_id`, `step_type`, `step_order`, `status`, `completed_at`, `completed_by`, `external_reference_id`, `metadata` (JSONB), `created_at`, `updated_at`.
- **Relationships**: Belongs to `Company` (`company_id` FK CASCADE).
- **Lifecycle**: `incomplete` $\rightarrow$ `completed`. Completion requires non-null `completed_at`.
- **Business Invariants**:
  - Step order must be between 1 and 8.
  - Each step type can exist only once per company.
  - Completion status must match timestamp presence.
- **Persistence Constraints**: `PRIMARY KEY (id)`, `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`, `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`, `UNIQUE (company_id, step_type)`, `UNIQUE (company_id, step_order)`, `CHECK (step_order BETWEEN 1 AND 8)`, `CHECK (ck_company_setup_completion)`.
- **TypeScript Representation**: `ICompanySetupStep` interface, `CompanySetupStepEntity` TypeORM class, `SetupStepType` enum, `SetupStepStatus` enum.

### Entity: Location (`locations`)
- **Purpose**: Represents physical or logical workplace locations owned by a company.
- **Aggregate**: Location Aggregate Root.
- **Tenant Scope**: Tenant-scoped (`tenant_id`).
- **Company Scope**: Company-scoped (`company_id`).
- **Identity**: System-generated `id` (UUIDv7), unique by `(company_id, code)`.
- **Attributes**: `id`, `tenant_id`, `company_id`, `code`, `name`, `description`, `country_code`, `timezone`, `address` (JSONB), `is_headquarter`, `status`, `effective_at`, `created_by`, `updated_by`, `created_at`, `updated_at`.
- **Relationships**: Belongs to `Company` (`company_id` FK CASCADE).
- **Lifecycle**: `scheduled` $\rightarrow$ `active` $\rightarrow$ `inactive`.
- **Business Invariants**:
  - Code must be unique per company.
  - At most one location per company can be HQ (`is_headquarter = true`) among active or scheduled locations.
- **Persistence Constraints**: `PRIMARY KEY (id)`, `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`, `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`, `UNIQUE (company_id, code)`, Partial Unique Index `uq_locations_one_headquarter_per_company`.
- **TypeScript Representation**: `ILocation` interface, `LocationEntity` TypeORM class, `CreateLocationDto`, `UpdateLocationDto`, `MasterDataStatus` enum.

### Entity: Department (`departments`)
- **Purpose**: Represents organizational units within a company, supporting hierarchical parent-child relationships.
- **Aggregate**: Department Aggregate Root.
- **Tenant Scope**: Tenant-scoped (`tenant_id`).
- **Company Scope**: Company-scoped (`company_id`).
- **Identity**: System-generated `id` (UUIDv7), unique by `(company_id, code)`.
- **Attributes**: `id`, `tenant_id`, `company_id`, `code`, `name`, `description`, `parent_department_id`, `status`, `effective_at`, `created_by`, `updated_by`, `created_at`, `updated_at`.
- **Relationships**:
  - Belongs to `Company` (`company_id` FK CASCADE).
  - Self-referencing parent-child relationship (`parent_department_id` FK RESTRICT).
  - Referenced by `JobTitle`.
- **Lifecycle**: `scheduled` $\rightarrow$ `active` $\rightarrow$ `inactive`.
- **Business Invariants**:
  - Code must be unique per company.
  - A department cannot be its own parent (`parent_department_id <> id`).
- **Persistence Constraints**: `PRIMARY KEY (id)`, `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`, `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`, `FOREIGN KEY (parent_department_id) REFERENCES departments(id) ON DELETE RESTRICT`, `UNIQUE (company_id, code)`, `CHECK (parent_department_id IS NULL OR parent_department_id <> id)`.
- **TypeScript Representation**: `IDepartment` interface, `DepartmentEntity` TypeORM class, `CreateDepartmentDto`, `UpdateDepartmentDto`.

### Entity: Grade (`grades`)
- **Purpose**: Represents job levels/pay grades within a company, with optional rank ordering.
- **Aggregate**: Grade Aggregate Root.
- **Tenant Scope**: Tenant-scoped (`tenant_id`).
- **Company Scope**: Company-scoped (`company_id`).
- **Identity**: System-generated `id` (UUIDv7), unique by `(company_id, code)`.
- **Attributes**: `id`, `tenant_id`, `company_id`, `code`, `name`, `description`, `rank_order`, `source_grade_id`, `status`, `effective_at`, `created_by`, `updated_by`, `created_at`, `updated_at`.
- **Relationships**:
  - Belongs to `Company` (`company_id` FK CASCADE).
  - Optional reference to template source grade (`source_grade_id` FK SET NULL).
  - Referenced by `JobTitle`.
- **Lifecycle**: `scheduled` $\rightarrow$ `active` $\rightarrow$ `inactive`.
- **Business Invariants**: Code must be unique per company.
- **Persistence Constraints**: `PRIMARY KEY (id)`, `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`, `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`, `FOREIGN KEY (source_grade_id) REFERENCES grades(id) ON DELETE SET NULL`, `UNIQUE (company_id, code)`.
- **TypeScript Representation**: `IGrade` interface, `GradeEntity` TypeORM class, `CreateGradeDto`, `UpdateGradeDto`.

### Entity: Job Title (`job_titles`)
- **Purpose**: Specific job positions within a company, explicitly linking a Department and a Grade.
- **Aggregate**: Job Title Aggregate Root.
- **Tenant Scope**: Tenant-scoped (`tenant_id`).
- **Company Scope**: Company-scoped (`company_id`).
- **Identity**: System-generated `id` (UUIDv7), unique by `(company_id, code)`.
- **Attributes**: `id`, `tenant_id`, `company_id`, `department_id`, `grade_id`, `code`, `name`, `description`, `source_job_title_id`, `status`, `effective_at`, `created_by`, `updated_by`, `created_at`, `updated_at`.
- **Relationships**:
  - Belongs to `Company` (`company_id` FK CASCADE).
  - Belongs to `Department` (`department_id` FK RESTRICT).
  - Belongs to `Grade` (`grade_id` FK RESTRICT).
  - Optional reference to template source job title (`source_job_title_id` FK SET NULL).
- **Lifecycle**: `scheduled` $\rightarrow$ `active` $\rightarrow$ `inactive`.
- **Business Invariants**:
  - Code must be unique per company.
  - Linked Department and Grade must belong to the same Company and Tenant.
- **Persistence Constraints**: `PRIMARY KEY (id)`, `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`, `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`, `FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT`, `FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE RESTRICT`, `FOREIGN KEY (source_job_title_id) REFERENCES job_titles(id) ON DELETE SET NULL`, `UNIQUE (company_id, code)`.
- **TypeScript Representation**: `IJobTitle` interface, `JobTitleEntity` TypeORM class, `CreateJobTitleDto`, `UpdateJobTitleDto`.

### Entity: Employee Reference (`employee_references`)
- **Purpose**: Local read-projection of employee data from Directory Service to support Point of Contact (PoC) assignments.
- **Aggregate**: Employee Reference Aggregate (Projection).
- **Tenant Scope**: Tenant-scoped (`tenant_id`).
- **Company Scope**: Company-scoped (`company_id`).
- **Identity**: System-generated `id` (UUIDv7), unique by `(tenant_id, employee_id)` and `(company_id, employee_number)`.
- **Attributes**: `id`, `tenant_id`, `employee_id`, `employee_number`, `company_id`, `display_name`, `employment_status`, `source_version`, `source_updated_at`, `created_at`, `updated_at`.
- **Relationships**:
  - Belongs to `Company` (`company_id` FK RESTRICT).
  - Referenced by `PoC` assignments via `employee_id`.
- **Lifecycle**: Read-only projection updated asynchronously from Directory Service events.
- **Business Invariants**: Unique employee ID per tenant and unique employee number per company.
- **Persistence Constraints**: `PRIMARY KEY (id)`, `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`, `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT`, `UNIQUE (tenant_id, employee_id)`, `UNIQUE (company_id, employee_number)`.
- **TypeScript Representation**: `IEmployeeReference` interface, `EmployeeReferenceEntity` TypeORM class.

### Entity: Point of Contact (`pocs`)
- **Purpose**: Assigns key functional responsibilities (e.g., `HR_HEAD`, `PAYROLL_OWNER`) within a company to an employee.
- **Aggregate**: Point of Contact Aggregate Root.
- **Tenant Scope**: Tenant-scoped (`tenant_id`).
- **Company Scope**: Company-scoped (`company_id`).
- **Identity**: System-generated `id` (UUIDv7).
- **Attributes**: `id`, `tenant_id`, `company_id`, `poc_type`, `employee_id`, `effective_at`, `status`, `created_by`, `updated_by`, `created_at`, `updated_at`.
- **Relationships**:
  - Belongs to `Company` (`company_id` FK CASCADE).
  - References `Employee Reference` logically via `(tenant_id, employee_id)`.
- **Lifecycle**: `scheduled` $\rightarrow$ `active` $\rightarrow$ `inactive`.
- **Business Invariants**: At most one active or scheduled assignment per `poc_type` per company (`uq_pocs_one_active_per_type`).
- **Persistence Constraints**: `PRIMARY KEY (id)`, `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`, `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`, Partial Unique Index `uq_pocs_one_active_per_type`.
- **TypeScript Representation**: `IPoc` interface, `PocEntity` TypeORM class, `CreatePocDto`, `UpdatePocDto`.

### Entity: Effective Change (`effective_changes`)
- **Purpose**: Stores future/scheduled modifications (`update`, `deactivate`) or pending creations for master data entities.
- **Aggregate**: Effective Change Aggregate Root.
- **Tenant Scope**: Tenant-scoped (`tenant_id`).
- **Company Scope**: Company-scoped (`company_id`).
- **Identity**: System-generated `id` (UUIDv7).
- **Attributes**: `id`, `tenant_id`, `company_id`, `entity_type`, `entity_id`, `operation`, `effective_at`, `status`, `payload` (JSONB), `expected_updated_at`, `attempt_count`, `last_attempted_at`, `processed_at`, `error_message`, `created_by`, `cancelled_by`, `cancelled_at`, `created_at`, `updated_at`.
- **Relationships**: Belongs to `Company` (`company_id` FK CASCADE), targets a master entity (`entity_id`).
- **Lifecycle**: `scheduled` $\rightarrow$ `processing` $\rightarrow$ `applied` | `failed` | `conflict` | `cancelled`.
- **Business Invariants**:
  - Target entity type must be one of: `location`, `department`, `grade`, `job_title`, `poc`.
  - At most one pending (`scheduled` or `processing`) change allowed per target entity.
  - If status is `cancelled`, `cancelled_at` must be recorded.
- **Persistence Constraints**: `PRIMARY KEY (id)`, `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`, `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`, Partial Unique Index `uq_effective_changes_one_pending_per_entity`, `CHECK (ck_effective_changes_entity_type)`, `CHECK (ck_effective_changes_cancelled)`.
- **TypeScript Representation**: `IEffectiveChange` interface, `EffectiveChangeEntity` TypeORM class, `ChangeOperation` enum, `EffectiveChangeStatus` enum.

---

## 3. Aggregate Model

Based strictly on schema ownership and foreign key deletion behavior:

1. **Company Aggregate Root**:
   - **Root**: `Company` (`companies`)
   - **Child Entities**: `Company Setup Step` (`company_setup_steps`) — *deleted via CASCADE when Company is deleted*.
2. **Master Data Aggregates (Independent Aggregate Roots)**:
   - `Location` aggregate root (`locations`)
   - `Department` aggregate root (`departments`)
   - `Grade` aggregate root (`grades`)
   - `JobTitle` aggregate root (`job_titles`)
   - `Point of Contact` aggregate root (`pocs`)
   - `Effective Change` aggregate root (`effective_changes`)
3. **Reference Projections (Read-Only Aggregate Roots)**:
   - `Tenant Reference` (`tenants`)
   - `Employee Reference` (`employee_references`)

---

## 4. Organizational Hierarchy

### Department Hierarchy
- **Structure**: Parent-Child tree within `departments`.
- **Parent Reference**: `parent_department_id` pointing to `departments(id)`.
- **Allowed Parent**: A department can optionally have one parent department. Root departments have `parent_department_id = NULL`.
- **Uniqueness Rules**: `(company_id, code)` must be unique across all departments in the company.
- **Boundary Rules**: Parent and child MUST belong to the same `company_id` and `tenant_id`.
- **Cycle Prevention**:
  - Schema enforces direct self-parenting prevention via `CHECK (parent_department_id IS NULL OR parent_department_id <> id)`.
  - Multi-level cycle prevention (e.g., A $\rightarrow$ B $\rightarrow$ C $\rightarrow$ A) is **NOT** enforced by database constraints and must be handled as a domain application invariant in `department.service.ts`.

---

## 5. Lifecycle Model

### Master Data Entities (`Location`, `Department`, `Grade`, `JobTitle`, `PoC`)
States governed by `master_data_status`:
- **`scheduled`**: Master record created with an `effective_at` timestamp in the future.
- **`active`**: Currently valid and operational master data record.
- **`inactive`**: Deactivated/archived master data record.

---

## 6. Effective-Dated Changes

1. **Direct Master Record Creation (`CREATE`)**: Master entity row inserted directly with `status = 'scheduled'`.
2. **Pending Modifications / Deactivations (`UPDATE` / `DEACTIVATE`)**: Stored in `effective_changes` with operation type and JSONB payload.

---

## 7. Business Invariants

| Invariant | Evidence Type | Schema / Domain Evidence |
| :--- | :--- | :--- |
| Tenant Isolation | FK / Unique Constraints | All entities contain `tenant_id` referencing `tenants(id) ON DELETE RESTRICT`. |
| Company Code Uniqueness | Unique Index | `uq_companies_tenant_code UNIQUE (tenant_id, company_code)` |
| Single Template Company | Partial Unique Index | `uq_companies_one_template_per_tenant UNIQUE (tenant_id) WHERE is_template = true` |
| One Active HQ Per Company | Partial Unique Index | `uq_locations_one_headquarter_per_company UNIQUE (company_id) WHERE is_headquarter = true AND status <> 'inactive'` |
| Master Data Code Uniqueness | Unique Index | `uq_<entity>_company_code UNIQUE (company_id, code)` for locations, departments, grades, job_titles |

---

## 8. Multi-Tenancy Model

- **Tenant Boundary**: Secured by `tenant_id` on every table and TypeORM entity filter condition.
- **Company Boundary**: Sub-tenant organizational partition (`company_id`).

---

## 9. Event-Relevant Domain Changes

Domain changes emit CloudEvents via Transactional Outbox.

---

## 10. Commands and Queries

High-level application use-cases in NestJS services.

---

## 11. Domain Validation Rules

- **SCHEMA-ENFORCED**: Uniqueness constraints, check constraints, step order limits.
- **DOMAIN-REQUIRED**: Cross-company validation, cycle detection, DTO validation using `class-validator`.

---

## 12. Schema-to-Domain Mapping

| SQL Table | Domain Entity | Aggregate | Tenant Scoped | Company Scoped | Important Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tenants` | Tenant Reference | Tenant Projection | Root | No | `UNIQUE (tenant_id, tenant_code)` |
| `companies` | Company | Company Root | Yes | Self | `UNIQUE (tenant_id, company_code)`, One template |
| `company_setup_steps` | Setup Step | Company Child | Yes | Yes | `UNIQUE (company_id, step_type)`, order 1-8 |
| `locations` | Location | Location Root | Yes | Yes | `UNIQUE (company_id, code)`, One active HQ |
| `departments` | Department | Department Root | Yes | Yes | `UNIQUE (company_id, code)`, No self-parent |
| `grades` | Grade | Grade Root | Yes | Yes | `UNIQUE (company_id, code)` |
| `job_titles` | Job Title | Job Title Root | Yes | Yes | `UNIQUE (company_id, code)`, FK Dept & Grade |
| `employee_references`| Employee Reference | Employee Projection| Yes | Yes | Read-only projection from Directory |
| `pocs` | Point of Contact | PoC Root | Yes | Yes | One active per `poc_type` |
| `effective_changes` | Effective Change | Effective Change Root| Yes | Yes | Max 1 pending per target entity |

---

## 13. Ambiguities and Gaps (OPEN QUESTIONS)

1. **Company Deactivation State**: Explicitly handled via application lifecycle rules if needed.
2. **Child References to Inactive Parents**: Managed in NestJS service validation.
