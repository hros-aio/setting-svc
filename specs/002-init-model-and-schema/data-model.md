# Data Model Specification: HRMS Setting Service

## 1. Domain Entities & Database Schema Mapping

### Entity: Tenant Reference (`tenants`)
- **Table**: `tenants`
- **TypeScript Interface**: `ITenant`
- **TypeORM Entity Class**: `TenantEntity`
- **Validation DTOs**: `CreateTenantDto`, `UpdateTenantDto`
- **Primary Key**: `id` (UUIDv7)
- **Attributes**:
  - `tenant_id`: UUID (NOT NULL, UNIQUE) — Canonical external tenant ID
  - `tenant_code`: varchar(64) (NOT NULL, UNIQUE) — Human-readable tenant identifier
  - `name`: varchar(255) (NOT NULL) — Tenant organization name
  - `source_version`: bigint (NOT NULL, DEFAULT 0) — External sync sequence version
  - `created_at`, `updated_at`: timestamptz (NOT NULL)

### Entity: Company (`companies`)
- **Table**: `companies`
- **TypeScript Interface**: `ICompany`
- **TypeORM Entity Class**: `CompanyEntity`
- **Validation DTOs**: `CreateCompanyDto`, `UpdateCompanyDto`
- **Enums**: `CompanyStatus` (`pending`, `active`)
- **Primary Key**: `id` (UUIDv7)
- **Foreign Keys**: `tenant_id` $\rightarrow$ `tenants(id) ON DELETE RESTRICT`
- **Attributes**:
  - `company_code`: varchar(64) (NOT NULL) — Unique code within tenant
  - `legal_name`: varchar(255) (NOT NULL)
  - `display_name`: varchar(255) (NULLABLE)
  - `status`: `company_status` ENUM (`pending`, `active`) (DEFAULT `pending`)
  - `is_template`: boolean (NOT NULL, DEFAULT false) — Tenant master template flag
  - `registration_number`, `tax_registration_number`: varchar(128)
  - `country_code`: char(2), `timezone`: varchar(64) (DEFAULT 'UTC'), `locale`: varchar(32), `currency_code`: char(3)
  - `legal_address`: jsonb
  - `information_completed_at`: timestamptz, `information_completed_by`: uuid
  - `activated_at`: timestamptz, `activated_by`: uuid
  - `created_by`, `updated_by`: uuid, `created_at`, `updated_at`: timestamptz
- **Constraints**:
  - `UNIQUE (tenant_id, company_code)`
  - Partial Unique Index: `uq_companies_one_template_per_tenant` on `(tenant_id) WHERE is_template = true`
  - `CHECK (ck_companies_activation_state)`: `status='pending' AND activated_at IS NULL` OR `status='active' AND activated_at IS NOT NULL`

### Entity: Company Setup Step (`company_setup_steps`)
- **Table**: `company_setup_steps`
- **TypeScript Interface**: `ICompanySetupStep`
- **TypeORM Entity Class**: `CompanySetupStepEntity`
- **Enums**: `SetupStepType` (`company_information`, `location`, `department`, `grade`, `job_title`, `role`, `employee_import`, `poc`), `SetupStepStatus` (`incomplete`, `completed`)
- **Primary Key**: `id` (UUIDv7)
- **Foreign Keys**:
  - `tenant_id` $\rightarrow$ `tenants(id) ON DELETE RESTRICT`
  - `company_id` $\rightarrow$ `companies(id) ON DELETE CASCADE`
- **Attributes**:
  - `step_type`: `setup_step_type` ENUM
  - `step_order`: smallint (NOT NULL, 1..8)
  - `status`: `setup_step_status` ENUM
  - `completed_at`: timestamptz, `completed_by`: uuid
  - `external_reference_id`: varchar(255), `metadata`: jsonb (DEFAULT `{}`)
- **Constraints**:
  - `UNIQUE (company_id, step_type)`
  - `UNIQUE (company_id, step_order)`
  - `CHECK (step_order BETWEEN 1 AND 8)`
  - `CHECK (ck_company_setup_completion)`

### Entity: Location (`locations`)
- **Table**: `locations`
- **TypeScript Interface**: `ILocation`
- **TypeORM Entity Class**: `LocationEntity`
- **Validation DTOs**: `CreateLocationDto`, `UpdateLocationDto`
- **Enums**: `MasterDataStatus` (`scheduled`, `active`, `inactive`)
- **Primary Key**: `id` (UUIDv7)
- **Foreign Keys**: `tenant_id` $\rightarrow$ `tenants(id)`, `company_id` $\rightarrow$ `companies(id) ON DELETE CASCADE`
- **Attributes**:
  - `code`: varchar(64) (NOT NULL), `name`: varchar(255) (NOT NULL), `description`: text
  - `country_code`: char(2), `timezone`: varchar(64), `address`: jsonb
  - `is_headquarter`: boolean (NOT NULL, DEFAULT false)
  - `status`: `master_data_status` ENUM (`scheduled`, `active`, `inactive`)
  - `effective_at`: timestamptz (NOT NULL)
- **Constraints**:
  - `UNIQUE (company_id, code)`
  - Partial Unique Index: `uq_locations_one_headquarter_per_company` on `(company_id) WHERE is_headquarter = true AND status <> 'inactive'`

### Entity: Department (`departments`)
- **Table**: `departments`
- **TypeScript Interface**: `IDepartment`
- **TypeORM Entity Class**: `DepartmentEntity`
- **Validation DTOs**: `CreateDepartmentDto`, `UpdateDepartmentDto`
- **Primary Key**: `id` (UUIDv7)
- **Foreign Keys**:
  - `tenant_id` $\rightarrow$ `tenants(id)`, `company_id` $\rightarrow$ `companies(id) ON DELETE CASCADE`
  - `parent_department_id` $\rightarrow$ `departments(id) ON DELETE RESTRICT`
- **Attributes**:
  - `code`: varchar(64) (NOT NULL), `name`: varchar(255) (NOT NULL), `description`: text
  - `status`: `master_data_status` ENUM (`scheduled`, `active`, `inactive`)
  - `effective_at`: timestamptz (NOT NULL)
- **Constraints**:
  - `UNIQUE (company_id, code)`
  - `CHECK (parent_department_id IS NULL OR parent_department_id <> id)`

### Entity: Grade (`grades`)
- **Table**: `grades`
- **TypeScript Interface**: `IGrade`
- **TypeORM Entity Class**: `GradeEntity`
- **Validation DTOs**: `CreateGradeDto`, `UpdateGradeDto`
- **Primary Key**: `id` (UUIDv7)
- **Foreign Keys**:
  - `tenant_id` $\rightarrow$ `tenants(id)`, `company_id` $\rightarrow$ `companies(id) ON DELETE CASCADE`
  - `source_grade_id` $\rightarrow$ `grades(id) ON DELETE SET NULL`
- **Attributes**:
  - `code`: varchar(64) (NOT NULL), `name`: varchar(255) (NOT NULL), `description`: text
  - `rank_order`: integer
  - `status`: `master_data_status` ENUM (`scheduled`, `active`, `inactive`)
  - `effective_at`: timestamptz (NOT NULL)
- **Constraints**: `UNIQUE (company_id, code)`

### Entity: Job Title (`job_titles`)
- **Table**: `job_titles`
- **TypeScript Interface**: `IJobTitle`
- **TypeORM Entity Class**: `JobTitleEntity`
- **Validation DTOs**: `CreateJobTitleDto`, `UpdateJobTitleDto`
- **Primary Key**: `id` (UUIDv7)
- **Foreign Keys**:
  - `tenant_id` $\rightarrow$ `tenants(id)`, `company_id` $\rightarrow$ `companies(id) ON DELETE CASCADE`
  - `department_id` $\rightarrow$ `departments(id) ON DELETE RESTRICT`
  - `grade_id` $\rightarrow$ `grades(id) ON DELETE RESTRICT`
  - `source_job_title_id` $\rightarrow$ `job_titles(id) ON DELETE SET NULL`
- **Attributes**:
  - `code`: varchar(64) (NOT NULL), `name`: varchar(255) (NOT NULL), `description`: text
  - `status`: `master_data_status` ENUM (`scheduled`, `active`, `inactive`)
  - `effective_at`: timestamptz (NOT NULL)
- **Constraints**: `UNIQUE (company_id, code)`

### Entity: Employee Reference (`employee_references`)
- **Table**: `employee_references`
- **TypeScript Interface**: `IEmployeeReference`
- **TypeORM Entity Class**: `EmployeeReferenceEntity`
- **Primary Key**: `id` (UUIDv7)
- **Foreign Keys**: `tenant_id` $\rightarrow$ `tenants(id)`, `company_id` $\rightarrow$ `companies(id) ON DELETE RESTRICT`
- **Attributes**:
  - `employee_id`: uuid (NOT NULL), `employee_number`: varchar(128) (NOT NULL)
  - `display_name`: varchar(255), `employment_status`: varchar(64)
  - `source_version`: bigint (NOT NULL, DEFAULT 0), `source_updated_at`: timestamptz
- **Constraints**: `UNIQUE (tenant_id, employee_id)`, `UNIQUE (company_id, employee_number)`

### Entity: Point of Contact (`pocs`)
- **Table**: `pocs`
- **TypeScript Interface**: `IPoc`
- **TypeORM Entity Class**: `PocEntity`
- **Validation DTOs**: `CreatePocDto`, `UpdatePocDto`
- **Primary Key**: `id` (UUIDv7)
- **Foreign Keys**: `tenant_id` $\rightarrow$ `tenants(id)`, `company_id` $\rightarrow$ `companies(id) ON DELETE CASCADE`
- **Attributes**:
  - `poc_type`: varchar(64) (NOT NULL) — e.g. `HR_HEAD`, `PAYROLL_OWNER`
  - `employee_id`: uuid (NOT NULL)
  - `status`: `master_data_status` ENUM (`scheduled`, `active`, `inactive`)
  - `effective_at`: timestamptz (NOT NULL)
- **Constraints**: Partial Unique Index `uq_pocs_one_active_per_type` on `(company_id, poc_type) WHERE status <> 'inactive'`

### Entity: Effective Change (`effective_changes`)
- **Table**: `effective_changes`
- **TypeScript Interface**: `IEffectiveChange`
- **TypeORM Entity Class**: `EffectiveChangeEntity`
- **Validation DTOs**: `ScheduleChangeDto`, `CancelChangeDto`
- **Enums**: `ChangeOperation` (`create`, `update`, `deactivate`), `EffectiveChangeStatus` (`scheduled`, `processing`, `applied`, `cancelled`, `failed`, `conflict`)
- **Primary Key**: `id` (UUIDv7)
- **Foreign Keys**: `tenant_id` $\rightarrow$ `tenants(id)`, `company_id` $\rightarrow$ `companies(id) ON DELETE CASCADE`
- **Attributes**:
  - `entity_type`: varchar(64) (NOT NULL) — `location`, `department`, `grade`, `job_title`, `poc`
  - `entity_id`: uuid (NOT NULL)
  - `operation`: `change_operation` ENUM (`create`, `update`, `deactivate`)
  - `effective_at`: timestamptz (NOT NULL)
  - `status`: `effective_change_status` ENUM (`scheduled`, `processing`, `applied`, `cancelled`, `failed`, `conflict`)
  - `payload`: jsonb (NOT NULL, DEFAULT `{}`)
  - `expected_updated_at`: timestamptz, `attempt_count`: integer (DEFAULT 0)
  - `last_attempted_at`: timestamptz, `processed_at`: timestamptz, `error_message`: text
  - `created_by`, `cancelled_by`: uuid, `cancelled_at`: timestamptz
- **Constraints**:
  - Partial Unique Index `uq_effective_changes_one_pending_per_entity` on `(company_id, entity_type, entity_id) WHERE status IN ('scheduled', 'processing')`
  - `CHECK (entity_type IN ('location', 'department', 'grade', 'job_title', 'poc'))`
  - `CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL)`
