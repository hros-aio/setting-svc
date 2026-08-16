# Quickstart Validation Guide: Company Setup Progress Tracking

## 1. Prerequisites
- PostgreSQL running locally or in Docker testcontainers.
- Redis instance running for event deduplication.
- Dependencies installed via `pnpm install`.

---

## 2. Automated Test Execution

### Run Unit Tests
Verify all company setup step repositories, services, controllers, and Kafka consumers:
```bash
pnpm test src/modules/company
pnpm test src/kafka/consumers
```

### Run Integration / E2E Tests
```bash
pnpm test:e2e test/company-setup-tracking.e2e-spec.ts
```

---

## 3. Manual End-to-End Validation Flow

### Step 1: Provision a New Company
Create a new company in `PENDING` status:
```bash
curl -X POST http://localhost:3000/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "companyCode": "ACME_CORP",
    "legalName": "Acme Corporation Pte Ltd",
    "displayName": "Acme Corp",
    "timezone": "Asia/Singapore"
  }'
```
*Expected Result*: Company created in `PENDING` status with 8 setup steps seeded as `INCOMPLETE`.

### Step 2: Query Initial Setup Progress
```bash
curl -X GET http://localhost:3000/companies/$COMPANY_ID/setup \
  -H "Authorization: Bearer $JWT_TOKEN"
```
*Expected Result*:
- `totalSteps`: 8
- `completedSteps`: 0
- `isEligibleForActivation`: `false`
- `incompleteSteps`: all 8 steps listed

### Step 3: Complete Company Information (Step 1)
```bash
curl -X PATCH http://localhost:3000/companies/$COMPANY_ID/information \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "registrationNumber": "REG-123456",
    "countryCode": "SG",
    "currencyCode": "SGD"
  }'
```
*Expected Result*: Step 1 (`COMPANY_INFORMATION`) becomes `COMPLETED`.

### Step 4: Complete Steps 2 to 5 & 8 via Local Module APIs
Create Location, Department, Grade, Job Title, and PoC records.

### Step 5: Simulate External Signals for Steps 6 and 7
Publish test events to Kafka topics `authorization.role-copy.completed` and `employee-import.batch.completed`.
Verify consumers process messages and update `ROLE` and `EMPLOYEE_IMPORT` step records.

### Step 6: Verify Final Activation Eligibility
Re-query setup progress:
```bash
curl -X GET http://localhost:3000/companies/$COMPANY_ID/setup \
  -H "Authorization: Bearer $JWT_TOKEN"
```
*Expected Result*:
- `completedSteps`: 8
- `isEligibleForActivation`: `true`
- `incompleteSteps`: `[]`
