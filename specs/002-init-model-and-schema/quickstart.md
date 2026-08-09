# Quickstart & Validation Guide: Setting Service Domain Model

## 1. Overview & Setup Prerequisites

This quickstart guide provides validation procedures to verify that `schema.sql` properly initializes the PostgreSQL database and enforces domain invariants.

### Prerequisites
- Docker & Docker Compose running PostgreSQL 18
- `psql` command line client

---

## 2. Validation Scenarios

### Scenario A: Verify Schema Execution
Run `schema.sql` against PostgreSQL to confirm zero execution errors:
```bash
psql -U postgres -d setting_db -f schema.sql
```
*Expected Outcome*: All ENUM types, tables (`tenants`, `companies`, `company_setup_steps`, `locations`, `departments`, `grades`, `job_titles`, `employee_references`, `pocs`, `effective_changes`), unique indexes, check constraints, and comments are created successfully.

### Scenario B: Multi-Tenancy & Code Uniqueness Validation
Verify that company codes are unique per tenant but can be repeated across different tenants:
```sql
-- Insert Tenant 1 and Tenant 2
INSERT INTO tenants (id, tenant_id, tenant_code, name) VALUES 
('01913912-1000-7000-8000-000000000001', '01913912-1000-7000-8000-000000000001', 'TENANT_A', 'Tenant A'),
('01913912-2000-7000-8000-000000000002', '01913912-2000-7000-8000-000000000002', 'TENANT_B', 'Tenant B');

-- Create Company COMP1 under Tenant A
INSERT INTO companies (tenant_id, company_code, legal_name) VALUES 
('01913912-1000-7000-8000-000000000001', 'COMP1', 'Company 1 Tenant A');

-- Create Company COMP1 under Tenant B (Must Succeed)
INSERT INTO companies (tenant_id, company_code, legal_name) VALUES 
('01913912-2000-7000-8000-000000000002', 'COMP1', 'Company 1 Tenant B');

-- Duplicate COMP1 under Tenant A (Must Fail with unique violation)
INSERT INTO companies (tenant_id, company_code, legal_name) VALUES 
('01913912-1000-7000-8000-000000000001', 'COMP1', 'Company Duplicate');
```
*Expected Outcome*: Duplicate COMP1 under Tenant A fails with `uq_companies_tenant_code` constraint violation.

### Scenario C: Single HQ per Company Validation
Verify partial index `uq_locations_one_headquarter_per_company`:
```sql
-- Insert HQ Location 1
INSERT INTO locations (tenant_id, company_id, code, name, is_headquarter, status, effective_at)
VALUES ('01913912-1000-7000-8000-000000000001', (SELECT id FROM companies WHERE company_code='COMP1'), 'HQ1', 'Headquarters 1', true, 'active', now());

-- Try inserting second HQ Location 2 for COMP1 (Must Fail)
INSERT INTO locations (tenant_id, company_id, code, name, is_headquarter, status, effective_at)
VALUES ('01913912-1000-7000-8000-000000000001', (SELECT id FROM companies WHERE company_code='COMP1'), 'HQ2', 'Headquarters 2', true, 'active', now());
```
*Expected Outcome*: Insertion of second HQ fails with partial index violation `uq_locations_one_headquarter_per_company`.
