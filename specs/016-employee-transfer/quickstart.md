# Quickstart & Verification Guide: Employee Transfer Between Companies

**Feature**: Employee Transfer Between Companies  
**Branch**: `016-employee-transfer`  
**Date**: 2026-08-19

## Prerequisites

- Node.js 20+ & pnpm
- Docker running (for PostgreSQL & Redis Testcontainers)
- Running local PostgreSQL instance (or Testcontainers for automated testing)

## Environment & Test Execution

### 1. Run Unit Tests

Execute unit tests covering transfer initiation, validation pipeline, date boundary enforcement, and duplicate pending checks:

```bash
pnpm test src/modules/employee-transfer
```

### 2. Run Integration Tests (Testcontainers)

Execute end-to-end repository and execution flow tests against PostgreSQL:

```bash
pnpm test:e2e test/employee-transfer.e2e-spec.ts
```

---

## Scenario-Based Verification

### Scenario A: Schedule Valid Employee Transfer (Future Date)

1. **Given**: An employee `EMP-001` active in `Company A`, and an active destination `Company B`.
2. **Action**: `POST /tenants/{tenantId}/companies/{companyA}/employees/{emp001}/transfers` with:
   - `destinationCompanyId`: `Company B`
   - `destinationJobTitleId`: Job Title active in `Company B`
   - `effectiveAt`: Next month (`2026-09-01T00:00:00.000Z`)
3. **Expected Result**:
   - HTTP 201 Created.
   - Transfer record in database has `status = 'PENDING'`.
   - `outbox_events` table contains an uncommitted/pending event `setting.effective-change.scheduled`.
   - `employee_references` table shows `EMP-001` is still attributed to `Company A`.

### Scenario B: Reject Immediate / Same-Day Transfer

1. **Given**: An employee `EMP-001` in `Company A`.
2. **Action**: `POST .../transfers` with `effectiveAt` set to today or yesterday.
3. **Expected Result**:
   - HTTP 400 Bad Request with error code `INVALID_EFFECTIVE_DATE`.
   - No row created in `employee_transfers` or `outbox_events`.

### Scenario C: Reject Duplicate Pending Transfer (Single Pending Invariant)

1. **Given**: An employee `EMP-001` with an existing `PENDING` transfer.
2. **Action**: Submit another `POST .../transfers` for `EMP-001`.
3. **Expected Result**:
   - HTTP 409 Conflict with error code `PENDING_TRANSFER_EXISTS`.
   - Database constraint `uq_employee_pending_transfer` protects against race conditions.

### Scenario D: Reject Cross-Company Master Data Reference

1. **Given**: Destination is `Company B`, but `destinationJobTitleId` belongs to `Company A`.
2. **Action**: Submit `POST .../transfers`.
3. **Expected Result**:
   - HTTP 422 Unprocessable Entity with error code `CROSS_COMPANY_REFERENCE_VIOLATION`.

### Scenario E: Execute Transfer on Effective Date

1. **Given**: A pending transfer for `EMP-001` with `effectiveAt <= NOW()`.
2. **Action**: Trigger `ExecuteEmployeeTransferHandler.execute(transferId)`.
3. **Expected Result**:
   - `employee_transfers.status` transitions from `PENDING` to `COMPLETED`.
   - `employee_references.company_id` updates to `Company B`.
   - Outbox table receives `employee.company-transferred` event.
   - Historical records in `employee_transfers` preserve prior source company attribution.
