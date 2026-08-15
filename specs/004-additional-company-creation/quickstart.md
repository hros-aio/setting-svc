# Quickstart Guide: Additional Company Creation Validation

## Overview
This guide provides end-to-end testing and verification workflows for validating the Additional Company Creation feature.

## Prerequisites
- Local PostgreSQL and Redis running (or Testcontainers active in test suite).
- Local Kafka broker running (for event verification).

## 1. Unit & Integration Testing Execution
Run the unit test suite covering DTO validation, template copy, step seeder, and repository operations:

```bash
pnpm test src/modules/company
pnpm test src/modules/company/services/template-copy.service.spec.ts
pnpm test src/modules/company/services/setup-step-seeder.service.spec.ts
```

## 2. API Scenario Verification

### Scenario A: Create Company without Template Copy
```bash
curl -X POST http://localhost:3000/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  -d '{
    "companyCode": "SUB_01",
    "name": "Subsidiary 01",
    "currency": "USD",
    "timezone": "America/New_York",
    "country": "US",
    "copyFromDefault": false
  }'
```
**Verification Points**:
- HTTP Status `201 Created`.
- `status` is `PENDING`.
- All 8 `setupSteps` return with status `INCOMPLETE`.
- 1 event (`company.created`) inserted in `outbox_events`.

---

### Scenario B: Create Company with Full Template Snapshot Copy
```bash
curl -X POST http://localhost:3000/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  -d '{
    "companyCode": "SUB_02",
    "name": "Subsidiary 02",
    "currency": "EUR",
    "timezone": "Europe/Berlin",
    "country": "DE",
    "copyFromDefault": true,
    "copyCategories": ["GRADES", "JOB_TITLES", "ROLES", "ORGANIZATION_RESPONSIBILITIES"]
  }'
```
**Verification Points**:
- HTTP Status `201 Created`.
- Setup steps for `GRADE`, `JOB_TITLE`, and `ORGANIZATION_RESPONSIBILITY` are `COMPLETED`.
- Setup step `ROLE` is `INCOMPLETE`.
- 2 outbox events (`company.created` and `authorization.role-copy.requested`) are written atomically.

---

### Scenario C: Verify Role Copy Kafka Completion
Publish mock completion event on Kafka:
```json
{
  "eventId": "mock-event-001",
  "eventType": "authorization.role-copy.completed",
  "payload": {
    "targetCompanyId": "<TARGET_COMPANY_ID>",
    "batchId": "batch-123",
    "copiedRoleCount": 5
  }
}
```
**Verification Points**:
- Setup step `ROLE` for `<TARGET_COMPANY_ID>` transitions from `INCOMPLETE` to `COMPLETED`.
- Deduplication key in Redis prevents re-execution on message replay.
