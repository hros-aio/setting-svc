# Quickstart & Verification Guide: Default Company Designation

## 1. Prerequisites & Environment Setup

Ensure local environment and dependencies are ready:

```bash
pnpm install
pnpm build
```

---

## 2. Automated Test Execution

### 2.1 Unit Tests

Run unit tests for company repository, service, and controller:

```bash
pnpm test src/modules/company/services/company.service.spec.ts
pnpm test src/modules/company/controllers/company.controller.spec.ts
pnpm test src/modules/company/repositories/company.repository.spec.ts
```

### 2.2 Integration & Database Verification

Run full test suite verifying database constraints and designation transfer:

```bash
pnpm test:e2e
```

---

## 3. Manual / API Verification Workflow

### Scenario 1: Transfer Default Company from Source to Target Company

1. Identify current default company (`Company A`) and target company (`Company B`) in tenant `TENANT_CODE`.
2. Send designation transfer request:
   ```bash
   curl -X PUT "http://localhost:3000/api/v1/companies/{{COMPANY_B_ID}}/default" \
     -H "Authorization: Bearer {{ADMIN_JWT}}" \
     -H "x-tenant-code: {{TENANT_CODE}}"
   ```
3. **Verify Response & Database**:
   - Response status `200 OK` with `data.isTemplate: true` for `Company B`.
   - `Company A` in `companies` table has `is_template = false`.
   - `Company B` in `companies` table has `is_template = true`.
   - Exactly one company in tenant has `is_template = true`.

### Scenario 2: Idempotent Re-Designation

1. Re-send designation request for `Company B`:
   ```bash
   curl -X PUT "http://localhost:3000/api/v1/companies/{{COMPANY_B_ID}}/default" \
     -H "Authorization: Bearer {{ADMIN_JWT}}" \
     -H "x-tenant-code: {{TENANT_CODE}}"
   ```
2. **Verify Response**:
   - Response status `200 OK` with `data.isTemplate: true`.
   - No database errors or constraint violations.

### Scenario 3: Multi-Tenant Isolation & Security Enforcement

1. Attempt to designate a company belonging to another tenant or without admin rights:
   ```bash
   curl -X PUT "http://localhost:3000/api/v1/companies/{{OTHER_TENANT_COMPANY_ID}}/default" \
     -H "Authorization: Bearer {{ADMIN_JWT}}" \
     -H "x-tenant-code: {{TENANT_CODE}}"
   ```
2. **Verify Response**:
   - Response status `404 Not Found`.
   - Zero state changes on either tenant's data.
