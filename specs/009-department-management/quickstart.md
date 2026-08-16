# Quickstart Validation Guide: Department Management

**Feature**: Department Management  
**Branch**: `009-department-management`  
**Date**: 2026-08-16  

---

## 1. Prerequisites & Environment Setup

- Node.js 22 LTS, pnpm, Docker & Docker Compose
- Running PostgreSQL 18 and Redis instances
- Running Kafka broker (or Testcontainers for automated testing)

```bash
# Install dependencies
pnpm install

# Run database migrations (or verify schema)
pnpm migration:run
```

---

## 2. Validation Scenarios

### Scenario 1: Create and Schedule Department & Verify Setup Step 3
1. Call `POST /departments` with valid payload, future effective date ($\ge$ EOD in company timezone), and optional parent.
2. Verify response HTTP 201 with `status: "scheduled"`.
3. Verify row in `departments` table with status `scheduled`.
4. Verify row in `company_setup_steps` table with `step = 'DEPARTMENT'` and `status = 'COMPLETED'`.
5. Verify row in `outbox_events` with `eventType = 'setting.effective-change.scheduled'`.

---

### Scenario 2: Hierarchy Loop & Cross-Company Parent Protection
1. Create Department A (Parent = NULL).
2. Create Department B (Parent = A).
3. Attempt `PATCH /departments/{A.id}` setting `parentDepartmentId = B.id`.
4. Verify response HTTP 409 Conflict indicating circular hierarchy detected.
5. Attempt `POST /departments` setting `parentDepartmentId` to a department from another company.
6. Verify response HTTP 400/404 indicating parent not found or invalid company scope.

---

### Scenario 3: Effective Execution Consumer State Transition
1. Emit `setting.effective-change.execute` Kafka event targeting a scheduled department creation.
2. Verify `departments.status` transitions from `scheduled` to `active`.
3. Verify outbox event with `eventType = 'setting.department.created'` generated in `outbox_events`.
4. Send duplicate execution command and verify idempotent acknowledgment without duplicate processing.

---

## 3. Automated Test Execution

```bash
# Run unit tests for Department module
pnpm test src/modules/department

# Run integration tests with Testcontainers
pnpm test:e2e test/department.e2e-spec.ts
```
