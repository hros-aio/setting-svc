# Quickstart & Verification Guide: Multi-Company Isolation

**Feature**: Multi-Company Isolation  
**Date**: 2026-08-18  
**Status**: Ready  

---

## 1. Prerequisites

- PostgreSQL instance running with migration schema applied (containing tables: `tenants`, `companies`, `locations`, `departments`, `grades`, `job_titles`, `pocs`, `effective_changes`, `outbox_events`).
- Setting Service running (`pnpm start:dev`).
- Authenticated JWT bearer tokens for:
  - Administrator authorized for `Company A` (`TOKEN_COMPANY_A`)
  - Administrator authorized for `Company B` (`TOKEN_COMPANY_B`)

---

## 2. Validation Scenarios

### Scenario 1: Same Code Creation in Sibling Companies (Valid Reuse)

#### Step 1: Create Grade `L3` in Company A
```bash
curl -X POST http://localhost:3000/api/v1/companies/${COMPANY_A_ID}/grades \
  -H "Authorization: Bearer ${TOKEN_COMPANY_A}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "L3",
    "name": "Senior Level 3",
    "rankOrder": 3,
    "effectiveAt": "2026-09-01T00:00:00Z"
  }'
```
**Expected Outcome**: HTTP 201 Created with Grade ID in Company A.

#### Step 2: Create Grade `L3` in Company B (Same Tenant)
```bash
curl -X POST http://localhost:3000/api/v1/companies/${COMPANY_B_ID}/grades \
  -H "Authorization: Bearer ${TOKEN_COMPANY_B}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "L3",
    "name": "Mid-Level Professional",
    "rankOrder": 3,
    "effectiveAt": "2026-09-01T00:00:00Z"
  }'
```
**Expected Outcome**: HTTP 201 Created with Grade ID in Company B. Uniqueness is scoped per company; no database collision occurs.

#### Step 3: Attempt Duplicate Grade `L3` within Company A
```bash
curl -X POST http://localhost:3000/api/v1/companies/${COMPANY_A_ID}/grades \
  -H "Authorization: Bearer ${TOKEN_COMPANY_A}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "L3",
    "name": "Duplicate Senior Grade",
    "rankOrder": 4,
    "effectiveAt": "2026-09-01T00:00:00Z"
  }'
```
**Expected Outcome**: HTTP 409 Conflict with message indicating code `L3` already exists in Company A.

---

### Scenario 2: Cross-Company Relational Binding Rejection

#### Attempt Job Title Creation in Company A referencing Grade from Company B
```bash
curl -X POST http://localhost:3000/api/v1/companies/${COMPANY_A_ID}/job-titles \
  -H "Authorization: Bearer ${TOKEN_COMPANY_A}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TECH_LEAD",
    "name": "Technical Lead",
    "departmentId": "'"${DEPT_COMPANY_A_ID}"'",
    "gradeId": "'"${GRADE_COMPANY_B_ID}"'",
    "effectiveAt": "2026-09-01T00:00:00Z"
  }'
```
**Expected Outcome**: HTTP 400 Bad Request with code `CROSS_COMPANY_REFERENCE_PROHIBITED` rejecting the cross-company grade reference.

---

### Scenario 3: Scope Guarding & Unauthorized Access Interception

#### User Authorized Only for Company A Accessing Company B Endpoints
```bash
curl -X GET http://localhost:3000/api/v1/companies/${COMPANY_B_ID}/locations \
  -H "Authorization: Bearer ${TOKEN_COMPANY_A}"
```
**Expected Outcome**: HTTP 403 Forbidden with code `COMPANY_SCOPE_FORBIDDEN`.

---

### Scenario 4: Kafka Outbox Partition Key Isolation

#### Verify Outbox Event Key Format
Query the `outbox_events` table after scheduling an effective change in Company A:
```sql
SELECT aggregate_type, aggregate_id, event_type, payload->>'tenantId' as tenant_id, payload->>'companyId' as company_id
FROM outbox_events
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 1;
```
**Expected Outcome**: Outbox payload carries explicit `tenantId` and `companyId`, and published Kafka message key equals `${tenantId}:${companyId}`.

---

## 3. Automated Test Execution

Run the complete suite of isolation and unit/integration tests:
```bash
# Run unit and integration tests
pnpm test

# Run specific isolation test suites
pnpm test -- --testPathPattern="job-title.service.spec.ts|department.service.spec.ts|poc.service.spec.ts|company.controller.spec.ts"
```
