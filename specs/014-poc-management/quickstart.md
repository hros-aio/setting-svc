# Quickstart Validation Guide: Organization Responsibility (Point of Contact) Management

## 1. Prerequisites
- Running Setting Service API (`pnpm start:dev` or test runner)
- PostgreSQL database migrated with `pocs`, `effective_changes`, `company_setup_steps`, and `employee_references` tables
- Seeded test data:
  - Tenant ID: `1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d`
  - Company ID: `7c9e6679-7425-40de-944b-e07fc1f90ae7` (in `pending` status)
  - Active Employee References: `EMP-001` (`550e8400-e29b-41d4-a716-446655440000`), `EMP-002` (`660e8400-e29b-41d4-a716-446655440111`)

---

## 2. Test Execution Commands

Run the unit and integration test suites:
```bash
# Run unit tests for PoC module
pnpm test src/modules/poc

# Run integration / controller tests
pnpm test --testPathPattern="poc"
```

---

## 3. End-to-End API Validation Flow

### Step 1: Create Initial PoC Assignment (`HR_HEAD`)
```bash
curl -X POST http://localhost:3000/companies/7c9e6679-7425-40de-944b-e07fc1f90ae7/pocs \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "pocType": "HR_HEAD",
    "employeeId": "550e8400-e29b-41d4-a716-446655440000",
    "effectiveAt": "2026-08-20T00:00:00.000Z"
  }'
```
**Expected Outcome**:
- Status: `201 Created`
- `pocs` table row inserted with `status = 'scheduled'`.
- `company_setup_steps` row for `poc` marked `COMPLETED`.
- Outbox event `setting.effective-change.scheduled` created.

---

### Step 2: Schedule PoC Replacement (`UPDATE`)
```bash
curl -X PUT http://localhost:3000/companies/7c9e6679-7425-40de-944b-e07fc1f90ae7/pocs/$POC_ID/replace \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "newEmployeeId": "660e8400-e29b-41d4-a716-446655440111",
    "effectiveAt": "2026-08-25T00:00:00.000Z",
    "reason": "Executive Succession"
  }'
```
**Expected Outcome**:
- Status: `200 OK`
- `effective_changes` row created in `scheduled` status.
- Original `pocs` record remains `active` (or `scheduled`) without immediate mutation.

---

### Step 3: Query Active PoCs with Employee Details
```bash
curl -X GET http://localhost:3000/companies/7c9e6679-7425-40de-944b-e07fc1f90ae7/pocs \
  -H "Authorization: Bearer $USER_JWT"
```
**Expected Outcome**:
- Status: `200 OK`
- Response list contains active PoCs with enriched display name and pending change indicator.

---

### Step 4: Schedule Deactivation
```bash
curl -X DELETE http://localhost:3000/companies/7c9e6679-7425-40de-944b-e07fc1f90ae7/pocs/$POC_ID \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "effectiveAt": "2026-08-30T00:00:00.000Z",
    "reason": "Retiring functional responsibility"
  }'
```
**Expected Outcome**:
- Status: `200 OK`
- Pending `DEACTIVATE` record created in `effective_changes`.
