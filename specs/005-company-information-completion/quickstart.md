# Quickstart & Verification Guide: Company Information Completion

## 1. Prerequisites & Environment Setup

Ensure local environment and required services (PostgreSQL, Redis, Kafka) are running:

```bash
# Verify test database containers and dependencies
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
```

### 2.2 Integration & Database Verification

Run Testcontainers-based integration suite verifying multi-tenant isolation, step transitions, and outbox event persistence:

```bash
pnpm test:e2e
```

---

## 3. Manual / API Verification Workflow

### Scenario 1: Initial Company Information Completion (Transition Step 1 to COMPLETED)

1. Create or identify a `PENDING` company with setup steps in `INCOMPLETE` status.
2. Send request to update company information:
   ```bash
   curl -X PATCH "http://localhost:3000/api/v1/companies/{{COMPANY_ID}}/information" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {{ADMIN_JWT}}" \
     -H "x-tenant-code: {{TENANT_CODE}}" \
     -d '{
       "name": "Acme SG Operations",
       "legalName": "Acme SG Operations Pte Ltd",
       "taxRegistrationNumber": "TAX-123456",
       "countryCode": "SG",
       "currencyCode": "SGD",
       "timezone": "Asia/Singapore"
     }'
   ```
3. **Verify Response**:
   - HTTP 200 OK
   - `data.setupSteps[0].stepType === "COMPANY_INFORMATION"` is `"completed"`
   - `data.setupSteps[0].completedAt` is populated
4. **Verify Database State**:
   - `companies` table has `information_completed_at` and `information_completed_by` set.
   - `outbox_events` table contains record with `event_type = 'company.updated'`.

### Scenario 2: Subsequent Profile Updates on Configured Company

1. Send subsequent update modifying `displayName` or `legalAddress`:
   ```bash
   curl -X PATCH "http://localhost:3000/api/v1/companies/{{COMPANY_ID}}/information" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {{ADMIN_JWT}}" \
     -H "x-tenant-code: {{TENANT_CODE}}" \
     -d '{
       "displayName": "Acme SG Headquarters"
     }'
   ```
2. **Verify Response**:
   - HTTP 200 OK
   - Step 1 remains in `completed` status without error.

### Scenario 3: Multi-Tenant Boundary Enforcement

1. Attempt to update `COMPANY_ID` using a different tenant's token or `x-tenant-code`.
2. **Verify Response**:
   - HTTP 404 Not Found (or 403 Forbidden).
   - Zero database mutation on target company.
