-- HRMS Setting Service
-- PostgreSQL 18
-- Simplified schema based on the approved Setting Module PRD
-- and the latest domain decisions.
--
-- Key decisions:
-- 1. No per-entity version tables.
-- 2. Audit history is owned by Log Service, not Setting DB.
-- 3. Company can be marked as template via is_template.
-- 4. Location includes is_headquarter.
-- 5. Job Title belongs to a Department and Grade.
-- 6. PoC is stored directly in pocs; no responsibility-type master table.
-- 7. Effective-dated create/update/deactivate is tracked through effective_changes.
-- 8. Role and Employee Import remain external domains; only setup completion is tracked here.
 
BEGIN;
 
-- ============================================================
-- ENUMS
-- ============================================================
 
DO $$ BEGIN
    CREATE TYPE company_status AS ENUM ('pending', 'active');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
 
DO $$ BEGIN
    CREATE TYPE setup_step_type AS ENUM (
        'company_information',
        'location',
        'department',
        'grade',
        'job_title',
        'role',
        'employee_import',
        'poc'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
 
DO $$ BEGIN
    CREATE TYPE setup_step_status AS ENUM ('incomplete', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
 
DO $$ BEGIN
    CREATE TYPE master_data_status AS ENUM (
        'scheduled',
        'active',
        'inactive'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
 
DO $$ BEGIN
    CREATE TYPE change_operation AS ENUM (
        'create',
        'update',
        'deactivate'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
 
DO $$ BEGIN
    CREATE TYPE effective_change_status AS ENUM (
        'scheduled',
        'processing',
        'applied',
        'cancelled',
        'failed',
        'conflict'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
 
-- ============================================================
-- TENANT REFERENCE
-- Local projection only. Tenant lifecycle belongs to Admin/Tenant domain.
-- ============================================================
 
CREATE TABLE IF NOT EXISTS tenants (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    tenant_id       uuid NOT NULL,
    tenant_code     varchar(64) NOT NULL,
    name            varchar(255) NOT NULL,
 
    source_version  bigint NOT NULL DEFAULT 0,
 
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
 
    CONSTRAINT uq_tenants_tenant_id UNIQUE (tenant_id),
    CONSTRAINT uq_tenants_tenant_code UNIQUE (tenant_code)
);
 
-- ============================================================
-- COMPANY
-- ============================================================
 
CREATE TABLE IF NOT EXISTS companies (
    id                      uuid PRIMARY KEY DEFAULT uuidv7(),
    tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 
    company_code            varchar(64) NOT NULL,
    legal_name              varchar(255) NOT NULL,
    display_name            varchar(255),
 
    status                  company_status NOT NULL DEFAULT 'pending',
 
    -- Template source for future company creation.
    -- Template means copy-on-create only; no live inheritance.
    is_template             boolean NOT NULL DEFAULT false,
 
    registration_number     varchar(128),
    tax_registration_number varchar(128),
    country_code            char(2),
    legal_address           jsonb,
 
    timezone                varchar(64) NOT NULL DEFAULT 'UTC',
    locale                  varchar(32),
    currency_code           char(3),
 
    information_completed_at timestamptz,
    information_completed_by uuid,
 
    activated_at            timestamptz,
    activated_by            uuid,
 
    created_by              uuid,
    updated_by              uuid,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
 
    CONSTRAINT uq_companies_tenant_code UNIQUE (tenant_id, company_code),
 
    CONSTRAINT ck_companies_activation_state CHECK (
        (status = 'pending' AND activated_at IS NULL)
        OR
        (status = 'active' AND activated_at IS NOT NULL)
    )
);
 
CREATE INDEX IF NOT EXISTS idx_companies_tenant_status
    ON companies (tenant_id, status);
 
-- At most one template company per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_one_template_per_tenant
    ON companies (tenant_id)
    WHERE is_template = true;
 
-- ============================================================
-- COMPANY SETUP
-- ============================================================
 
CREATE TABLE IF NOT EXISTS company_setup_steps (
    id                  uuid PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 
    step_type           setup_step_type NOT NULL,
    step_order          smallint NOT NULL,
    status              setup_step_status NOT NULL DEFAULT 'incomplete',
 
    completed_at        timestamptz,
    completed_by        uuid,
 
    -- Used for external setup steps such as Role or Employee Import.
    external_reference_id varchar(255),
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
 
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
 
    CONSTRAINT uq_company_setup_step UNIQUE (company_id, step_type),
    CONSTRAINT uq_company_setup_order UNIQUE (company_id, step_order),
    CONSTRAINT ck_company_setup_order CHECK (step_order BETWEEN 1 AND 8),
    CONSTRAINT ck_company_setup_completion CHECK (
        (status = 'incomplete' AND completed_at IS NULL)
        OR
        (status = 'completed' AND completed_at IS NOT NULL)
    )
);
 
CREATE INDEX IF NOT EXISTS idx_company_setup_steps_progress
    ON company_setup_steps (company_id, step_order, status);
 
-- ============================================================
-- LOCATION
-- ============================================================
 
CREATE TABLE IF NOT EXISTS locations (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 
    code            varchar(64) NOT NULL,
    name            varchar(255) NOT NULL,
    description     text,
 
    country_code    char(2),
    timezone        varchar(64),
    address         jsonb,
 
    is_headquarter  boolean NOT NULL DEFAULT false,
    status          master_data_status NOT NULL DEFAULT 'scheduled',
 
    effective_at    timestamptz NOT NULL,
 
    created_by      uuid,
    updated_by      uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
 
    CONSTRAINT uq_locations_company_code UNIQUE (company_id, code)
);
 
CREATE INDEX IF NOT EXISTS idx_locations_company_status
    ON locations (company_id, status);
 
-- Optional business rule:
-- only one active/scheduled HQ per company at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_one_headquarter_per_company
    ON locations (company_id)
    WHERE is_headquarter = true
      AND status <> 'inactive';
 
-- ============================================================
-- DEPARTMENT
-- ============================================================
 
CREATE TABLE IF NOT EXISTS departments (
    id                  uuid PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 
    code                varchar(64) NOT NULL,
    name                varchar(255) NOT NULL,
    description         text,
 
    parent_department_id uuid REFERENCES departments(id) ON DELETE RESTRICT,
 
    status              master_data_status NOT NULL DEFAULT 'scheduled',
    effective_at        timestamptz NOT NULL,
 
    created_by          uuid,
    updated_by          uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
 
    CONSTRAINT uq_departments_company_code UNIQUE (company_id, code),
    CONSTRAINT ck_departments_not_self_parent CHECK (
        parent_department_id IS NULL OR parent_department_id <> id
    )
);
 
CREATE INDEX IF NOT EXISTS idx_departments_company_status
    ON departments (company_id, status);
 
-- ============================================================
-- GRADE
-- ============================================================
 
CREATE TABLE IF NOT EXISTS grades (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 
    code            varchar(64) NOT NULL,
    name            varchar(255) NOT NULL,
    description     text,
    rank_order      integer,
 
    -- Traceability for data copied from a template company.
    -- This is informational only; no inheritance behavior.
    source_grade_id uuid REFERENCES grades(id) ON DELETE SET NULL,
 
    status          master_data_status NOT NULL DEFAULT 'scheduled',
    effective_at    timestamptz NOT NULL,
 
    created_by      uuid,
    updated_by      uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
 
    CONSTRAINT uq_grades_company_code UNIQUE (company_id, code)
);
 
CREATE INDEX IF NOT EXISTS idx_grades_company_status
    ON grades (company_id, status);
 
-- ============================================================
-- JOB TITLE
-- Job Title belongs to both Department and Grade.
-- ============================================================
 
CREATE TABLE IF NOT EXISTS job_titles (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 
    department_id   uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    grade_id        uuid NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
 
    code            varchar(64) NOT NULL,
    name            varchar(255) NOT NULL,
    description     text,
 
    source_job_title_id uuid REFERENCES job_titles(id) ON DELETE SET NULL,
 
    status          master_data_status NOT NULL DEFAULT 'scheduled',
    effective_at    timestamptz NOT NULL,
 
    created_by      uuid,
    updated_by      uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
 
    CONSTRAINT uq_job_titles_company_code UNIQUE (company_id, code)
);
 
CREATE INDEX IF NOT EXISTS idx_job_titles_company_department
    ON job_titles (company_id, department_id);
 
CREATE INDEX IF NOT EXISTS idx_job_titles_company_grade
    ON job_titles (company_id, grade_id);
 
CREATE INDEX IF NOT EXISTS idx_job_titles_company_status
    ON job_titles (company_id, status);
 
-- ============================================================
-- EMPLOYEE REFERENCE
-- Local projection from Directory Service.
-- Setting Service does not own employee master data.
-- ============================================================
 
CREATE TABLE IF NOT EXISTS employee_references (
    id                  uuid PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 
    employee_id         uuid NOT NULL,
    employee_number     varchar(128) NOT NULL,
    company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 
    display_name        varchar(255),
    employment_status   varchar(64),
 
    source_version      bigint NOT NULL DEFAULT 0,
    source_updated_at   timestamptz,
 
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
 
    CONSTRAINT uq_employee_references_tenant_employee
        UNIQUE (tenant_id, employee_id),
 
    CONSTRAINT uq_employee_references_company_number
        UNIQUE (company_id, employee_number)
);
 
CREATE INDEX IF NOT EXISTS idx_employee_references_company
    ON employee_references (company_id, employment_status);
 
-- ============================================================
-- PoC
-- No responsibility-type table.
-- poc_type is a business-defined string such as:
-- COUNTRY_HEAD, HR_HEAD, FINANCE_HEAD, IT_HEAD, PAYROLL_OWNER.
-- ============================================================
 
CREATE TABLE IF NOT EXISTS pocs (
    id                  uuid PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 
    poc_type            varchar(64) NOT NULL,
    employee_id         uuid NOT NULL,
 
    effective_at        timestamptz NOT NULL,
    status              master_data_status NOT NULL DEFAULT 'scheduled',
 
    created_by          uuid,
    updated_by          uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
 
CREATE INDEX IF NOT EXISTS idx_pocs_company_type
    ON pocs (company_id, poc_type, status);
 
CREATE INDEX IF NOT EXISTS idx_pocs_employee
    ON pocs (tenant_id, employee_id);
 
-- One current/scheduled assignment per PoC type per company.
-- If later the product needs primary/secondary PoC, remove/adjust this rule.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pocs_one_active_per_type
    ON pocs (company_id, poc_type)
    WHERE status <> 'inactive';
 
-- ============================================================
-- EFFECTIVE CHANGES
--
-- Since master tables store current/scheduled state directly and there are
-- no version tables, future UPDATE / DEACTIVATE operations are stored here.
--
-- CREATE can either:
--   A) create the master row immediately with status=scheduled, or
--   B) keep the pending payload here until effective_at.
--
-- This schema supports both, but the recommended simple approach is:
-- CREATE -> insert master row as scheduled
-- UPDATE/DEACTIVATE -> create an effective_changes record
-- ============================================================
 
CREATE TABLE IF NOT EXISTS effective_changes (
    id                  uuid PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 
    entity_type         varchar(64) NOT NULL,
    entity_id           uuid NOT NULL,
 
    operation           change_operation NOT NULL,
    effective_at        timestamptz NOT NULL,
    status              effective_change_status NOT NULL DEFAULT 'scheduled',
 
    -- Future state/delta that will be applied when effective.
    payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
 
    -- Used to avoid applying a stale scheduled update.
    expected_updated_at timestamptz,
 
    attempt_count       integer NOT NULL DEFAULT 0,
    last_attempted_at   timestamptz,
    processed_at        timestamptz,
 
    error_message       text,
 
    created_by          uuid,
    cancelled_by        uuid,
    cancelled_at        timestamptz,
 
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
 
    CONSTRAINT ck_effective_changes_entity_type CHECK (
        entity_type IN ('location', 'department', 'grade', 'job_title', 'poc')
    ),
 
    CONSTRAINT ck_effective_changes_cancelled CHECK (
        status <> 'cancelled' OR cancelled_at IS NOT NULL
    )
);
 
CREATE INDEX IF NOT EXISTS idx_effective_changes_due
    ON effective_changes (effective_at)
    WHERE status = 'scheduled';
 
CREATE INDEX IF NOT EXISTS idx_effective_changes_company
    ON effective_changes (company_id, status, effective_at);
 
-- At most one unresolved scheduled change per entity.
CREATE UNIQUE INDEX IF NOT EXISTS uq_effective_changes_one_pending_per_entity
    ON effective_changes (company_id, entity_type, entity_id)
    WHERE status IN ('scheduled', 'processing');
 
-- ============================================================
-- COMMENTS
-- ============================================================
 
COMMENT ON COLUMN companies.is_template IS
'Marks the company as the tenant configuration template. New companies may copy data from it once; there is no live inheritance.';
 
COMMENT ON COLUMN locations.is_headquarter IS
'Indicates the company headquarter location.';
 
COMMENT ON TABLE employee_references IS
'Local read projection from Directory Service; Setting Service does not own employee master data.';
 
COMMENT ON TABLE pocs IS
'Company-scoped Point of Contact assignments. poc_type is directly stored as business data; no separate type table.';
 
COMMENT ON TABLE effective_changes IS
'Stores future updates/deactivations for Setting master data. Audit history is owned by Log Service.';
 
COMMIT;