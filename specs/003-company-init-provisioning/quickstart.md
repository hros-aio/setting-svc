# Quickstart & Verification Guide: Company Initialization at Tenant Provisioning

## Overview
This guide describes how to run and verify the end-to-end company initialization flow triggered by the `tenant.created` Kafka event on topic `tenant.lifecycle-events`.

## Prerequisites
- PostgreSQL database running (or via Testcontainers during automated integration tests)
- Redis instance running
- Kafka broker running (or mocked in unit/integration tests)

## Automated Verification

Run the integration and unit tests for company provisioning:

```bash
# Run unit tests
pnpm test src/modules/company

# Run e2e / integration tests
pnpm test:e2e
```

## Manual Verification via Event Simulation

### 1. Simulate Publishing `tenant.created` Event
Publish an event matching the [contract](contracts/tenant-lifecycle-events.contract.json) to Kafka topic `tenant.lifecycle-events`:

```json
{
  "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "correlationId": "corr-test-1001",
  "topic": "tenant.lifecycle-events",
  "eventType": "tenant.created",
  "timestamp": "2026-08-15T10:00:00.000Z",
  "payload": {
    "tenantId": "c1f7b0e2-76b1-4f51-b844-4860d5b3d001",
    "tenantCode": "ACME_CORP",
    "name": "Acme Global Solutions",
    "legalName": "Acme Global Solutions Inc.",
    "countryCode": "US",
    "currencyCode": "USD",
    "timezone": "America/New_York",
    "sourceVersion": 1
  }
}
```

### 2. Verify Database State
Query the setting database to verify atomic provisioning:

```sql
-- 1. Verify Tenant projection
SELECT * FROM tenants WHERE tenant_code = 'ACME_CORP';

-- 2. Verify Company created in PENDING status
SELECT id, tenant_id, company_code, legal_name, status, is_template 
FROM companies 
WHERE company_code = 'ACME_CORP';

-- 3. Verify exactly 8 setup steps seeded in INCOMPLETE status
SELECT step_order, step_type, status 
FROM company_setup_steps 
WHERE tenant_id = (SELECT id FROM tenants WHERE tenant_code = 'ACME_CORP')
ORDER BY step_order ASC;

-- 4. Verify Consumed Event recorded
SELECT * FROM consumed_events WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
```

### 3. Verify Idempotency on Redelivery
Re-publish the exact same event payload:
- Ensure the consumer completes successfully without error.
- Verify no duplicate rows exist in `companies` or `company_setup_steps`.
