# Quickstart & Verification Guide: Job Title Management

## Prerequisites

1. PostgreSQL database running and migrated with tables: `tenants`, `companies`, `departments`, `grades`, `job_titles`, `effective_changes`, `company_setup_steps`, `outbox_events`.
2. Redis running for execution deduplication.
3. Node.js 22 LTS / pnpm environment.

---

## 1. Unit & Integration Test Execution

Run test suites covering Job Title repository, service, cross-company validation, query projections, and execution apply handlers:

```bash
# Run all unit tests for Job Title module
pnpm test src/modules/job-title

# Run integration tests against Testcontainers PostgreSQL & Redis
pnpm test:e2e test/integration/job-title
```

---

## 2. End-to-End Validation Scenarios

### Scenario A: Create and Schedule Job Title & Complete Setup Step 5

1. **Given**: An active Company with an active Department (`dept_id`) and Grade (`grade_id`).
2. **Execute**: `POST /job-titles` with `effectiveAt = tomorrow at 23:59:59 UTC`, `departmentId`, and `gradeId`.
3. **Verify**:
   - HTTP `201 Created` returned.
   - Database row created in `job_titles` with `status = 'scheduled'`.
   - `company_setup_steps` row for `step_type = 'JOB_TITLE'` updated to `COMPLETED`.
   - `outbox_events` row staged with `event_type = 'setting.effective-change.scheduled'`.

### Scenario B: Reject Cross-Company Department or Grade Association (ADR-14)

1. **Given**: Company A and Company B. Department 1 belongs to Company B.
2. **Execute**: `POST /job-titles` in the context of Company A referencing Department 1.
3. **Verify**:
   - HTTP `400 Bad Request` returned with domain validation failure.
   - No rows persisted in `job_titles` or `outbox_events`.

### Scenario C: Schedule Update and Enforce Single Pending Change Invariant

1. **Given**: An active Job Title `jt_1`.
2. **Execute**: `PATCH /job-titles/jt_1` with updated `name` and future `effectiveAt`.
3. **Verify**:
   - HTTP `200 OK` returned.
   - `effective_changes` record created with `operation = 'UPDATE'`, `status = 'scheduled'`.
   - Master `job_titles` row remains active and unmodified.
4. **Execute**: Second `PATCH /job-titles/jt_1` or `POST /job-titles/jt_1/deactivate`.
5. **Verify**:
   - HTTP `409 Conflict` returned with message indicating a pending change already exists.

### Scenario D: Idempotent Execution Maturity Transition

1. **Given**: Job Title in `scheduled` status (or `effective_changes` in `scheduled` status).
2. **Execute**: Simulate Kafka message `setting.effective-change.execute` received by consumer.
3. **Verify**:
   - Status transitions to `active` (or `inactive` / applied fields).
   - Redis sets deduplication key `setting:dedup:{eventId}`.
   - Public domain event written to `outbox_events` for `setting.master-data.events`.
4. **Execute**: Re-send identical `setting.effective-change.execute` message with same `eventId`.
5. **Verify**:
   - Message skipped idempotently with zero secondary writes or duplicate outbox emissions.
