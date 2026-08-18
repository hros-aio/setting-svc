# Quickstart Guide: Company Activation

## Overview

This guide describes how to validate the Company Activation feature end-to-end.

---

## 1. Prerequisites

- PostgreSQL instance running and migrations applied.
- Valid JWT token representing an authenticated `Administrator` with tenant context.

---

## 2. Validation Scenarios

### Scenario A: Successful Company Activation (All 8 Steps Complete)

1. Provision a company `POST /companies` (creates company in `PENDING` status with 8 setup steps in `INCOMPLETE` status).
2. Complete all 8 setup steps:
   - Step 1: `PATCH /companies/:id/information`
   - Step 2: `POST /locations`
   - Step 3: `POST /departments`
   - Step 4: `POST /grades`
   - Step 5: `POST /job-titles`
   - Step 6: `POST /pocs`
   - Step 7: External event `authorization.role-copy.completed` / `ROLES`
   - Step 8: External event `employee-import.completed` / `EMPLOYEE_IMPORT`
3. Verify `GET /companies/:id/setup` returns `isEligibleForActivation: true` and `incompleteSteps: []`.
4. Trigger activation:
   ```bash
   curl -X POST "http://localhost:3000/companies/$COMPANY_ID/activate" \
     -H "Authorization: Bearer $ADMIN_JWT" \
     -H "Content-Type: application/json"
   ```
5. **Expected Outcome**:
   - Status 200 OK.
   - Company object returned with `status: "ACTIVE"`, `activatedAt`, and `activatedBy` populated.
   - Outbox table contains row with `eventType: "company.activated"` and `status: "PENDING"`.

---

### Scenario B: Rejection Due to Incomplete Steps

1. Create a company in `PENDING` status.
2. Complete only Step 1 (`COMPANY_INFORMATION`).
3. Trigger activation:
   ```bash
   curl -X POST "http://localhost:3000/companies/$COMPANY_ID/activate" \
     -H "Authorization: Bearer $ADMIN_JWT"
   ```
4. **Expected Outcome**:
   - Status 422 Unprocessable Entity.
   - Response contains:
     ```json
     {
       "statusCode": 422,
       "error": "Unprocessable Entity",
       "message": "Company activation rejected: mandatory setup steps are incomplete.",
       "incompleteSteps": [
         "LOCATION",
         "DEPARTMENT",
         "GRADE",
         "JOB_TITLE",
         "POINT_OF_CONTACT",
         "ROLES",
         "EMPLOYEE_IMPORT"
       ]
     }
     ```
   - Company `status` remains `PENDING` in database.
   - No outbox event written.

---

### Scenario C: Rejection for Already Active Company

1. Using an already active company from Scenario A:
2. Trigger activation again:
   ```bash
   curl -X POST "http://localhost:3000/companies/$COMPANY_ID/activate" \
     -H "Authorization: Bearer $ADMIN_JWT"
   ```
3. **Expected Outcome**:
   - Status 422 Unprocessable Entity.
   - Error message indicates company is already active.

---

### Scenario D: Tenant Isolation & Non-Admin RBAC Protection

1. Trigger activation using an HR Business User token:
   - **Expected Outcome**: Status 403 Forbidden.
2. Trigger activation with Tenant A token against a company belonging to Tenant B:
   - **Expected Outcome**: Status 404 Not Found.
