# Quickstart Validation Guide: Grade Management

**Feature**: Grade Management  
**Branch**: `010-grade-management`  
**Date**: 2026-08-16  

---

## 1. Prerequisites & Environment Setup

- Node.js 22 LTS, pnpm, Docker & Docker Compose
- Running PostgreSQL 18 and Redis instances
- Running Kafka broker (or Testcontainers for automated testing)

```bash
# Install dependencies
pnpm install

# Run database schema / migrations verification
pnpm migration:run
```

---

## 2. Validation Scenarios

### Scenario 1: Create and Schedule Grade & Verify Setup Step 4
1. Call `POST /grades` with valid payload (`code: "L3"`, `name: "Senior Software Engineer"`, `rankOrder: 3`) and future effective date ($\ge$ EOD in company timezone).
2. Verify response HTTP 201 with `status: "scheduled"`.
3. Verify row in `grades` table with status `scheduled`.
4. Verify row in `company_setup_steps` table with `step = 'GRADE'` and `status = 'COMPLETED'`.
5. Verify row in `outbox_events` with `eventType = 'setting.effective-change.scheduled'`.

---

### Scenario 2: Single Pending Change & Company Code Uniqueness
1. Create and schedule Grade "L3" in Company A.
2. Attempt to create another Grade with code "L3" in Company A $\to$ Verify HTTP 409 Conflict.
3. Create Grade "L3" in Company B $\to$ Verify HTTP 201 Created (verifies company-scoped code uniqueness).
4. For an active Grade, schedule an update via `PATCH /grades/{id}` $\to$ Verify HTTP 200 OK and row in `effective_changes` with status `scheduled`.
5. Attempt a second update or deactivation on the same Grade $\to$ Verify HTTP 409 Conflict (enforcing single pending change).

---

### Scenario 3: Effective Execution Consumer State Transition
1. Emit `setting.effective-change.execute` Kafka event targeting a scheduled Grade creation.
2. Verify `grades.status` transitions from `scheduled` to `active`.
3. Verify outbox event with `eventType = 'setting.grade.created'` generated in `outbox_events`.
4. Send duplicate execution command and verify idempotent acknowledgment via Redis `SETNX` without duplicate processing.

---

## 3. Automated Test Execution

```bash
# Run unit tests for Grade module
pnpm test src/modules/grade

# Run e2e / integration tests
pnpm test:e2e test/grade.e2e-spec.ts
```
