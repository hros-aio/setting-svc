# API & Event Contracts: Grade Management

**Feature**: Grade Management  
**Branch**: `010-grade-management`  
**Date**: 2026-08-16  

---

## 1. REST API Endpoints

All endpoints require JWT RS256 authentication and role-based permissions (`@Permissions()`), enforcing tenant and company scoping via `RequestContext`.

### 1.1 `POST /grades` (Create & Schedule Grade)

Schedules a new Grade creation with a future effective date and emits an outbox scheduling event.

- **Headers**:
  - `Authorization: Bearer <jwt>`
  - `x-tenant-id: <uuid>` (or derived from JWT)
  - `x-company-id: <uuid>` (or derived from JWT)

- **Request Body (`CreateGradeDto`)**:
  ```json
  {
    "code": "L3",
    "name": "Senior Software Engineer",
    "description": "Senior professional contributor leveling band",
    "rankOrder": 3,
    "effectiveAt": "2026-08-20T00:00:00.000Z"
  }
  ```

- **Responses**:
  - `201 Created` (or `202 Accepted`):
    ```json
    {
      "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "tenantId": "f1e2d3c4-b5a6-4f7e-8d9c-0b1a2c3d4e5f",
      "companyId": "b1a2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "code": "L3",
      "name": "Senior Software Engineer",
      "description": "Senior professional contributor leveling band",
      "rankOrder": 3,
      "status": "scheduled",
      "effectiveAt": "2026-08-20T00:00:00.000Z",
      "createdAt": "2026-08-16T12:00:00.000Z",
      "updatedAt": "2026-08-16T12:00:00.000Z"
    }
    ```
  - `400 Bad Request`: Validation failure (missing required fields, past effective date).
  - `409 Conflict`: Duplicate Grade code within company.

---

### 1.2 `PATCH /grades/:id` (Schedule Grade Update)

Schedules modifications for an active Grade in `effective_changes` without modifying the active master row before the effective date.

- **Request Body (`UpdateGradeDto`)**:
  ```json
  {
    "name": "Lead Senior Software Engineer",
    "description": "Updated leveling description",
    "rankOrder": 4,
    "effectiveAt": "2026-08-25T00:00:00.000Z"
  }
  ```

- **Responses**:
  - `200 OK`:
    ```json
    {
      "changeId": "e8c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
      "gradeId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "status": "scheduled",
      "effectiveAt": "2026-08-25T00:00:00.000Z",
      "payload": {
        "name": "Lead Senior Software Engineer",
        "description": "Updated leveling description",
        "rankOrder": 4
      }
    }
    ```
  - `400 Bad Request`: Invalid payload / effective date.
  - `404 Not Found`: Target Grade not found.
  - `409 Conflict`: Pending change already exists (`BR-13`) or Grade is not active.

---

### 1.3 `POST /grades/:id/deactivate` (Schedule Grade Deactivation)

Schedules the deactivation of an active Grade.

- **Request Body (`DeactivateGradeDto`)**:
  ```json
  {
    "effectiveAt": "2026-08-30T00:00:00.000Z"
  }
  ```

- **Responses**:
  - `200 OK`:
    ```json
    {
      "changeId": "f9d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
      "gradeId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "status": "scheduled",
      "effectiveAt": "2026-08-30T00:00:00.000Z"
    }
    ```
  - `409 Conflict`: Pending change already exists or Grade is already inactive.

---

### 1.4 `GET /grades` (Query Grades List)

Retrieves Grades for the caller's company. Supports pagination and filtering by status (`active`, `scheduled`, `inactive`, or `all`).

- **Query Parameters (`QueryGradeDto`)**:
  - `page`: number (default 1)
  - `limit`: number (default 20, max 100)
  - `status`: string (enum: `active`, `scheduled`, `inactive`, `all`, default: `active`)
  - `search`: string (optional search on name/code)

- **Responses**:
  - `200 OK`:
    ```json
    {
      "items": [
        {
          "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
          "code": "L3",
          "name": "Senior Software Engineer",
          "description": "Senior professional contributor leveling band",
          "rankOrder": 3,
          "status": "active",
          "effectiveAt": "2026-08-01T00:00:00.000Z",
          "createdAt": "2026-07-25T00:00:00.000Z",
          "updatedAt": "2026-08-01T00:00:00.000Z"
        }
      ],
      "total": 1,
      "page": 1,
      "limit": 20
    }
    ```

---

### 1.5 `GET /grades/:id` (Get Grade Details & Pending Changes)

Retrieves full Grade details including any active scheduled pending changes.

- **Responses**:
  - `200 OK`:
    ```json
    {
      "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "code": "L3",
      "name": "Senior Software Engineer",
      "rankOrder": 3,
      "status": "active",
      "effectiveAt": "2026-08-01T00:00:00.000Z",
      "pendingChange": {
        "changeId": "e8c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        "action": "UPDATE",
        "status": "scheduled",
        "effectiveAt": "2026-08-25T00:00:00.000Z",
        "payload": {
          "name": "Lead Senior Software Engineer",
          "rankOrder": 4
        }
      }
    }
    ```
  - `404 Not Found`: Grade does not exist in the caller's company.

---

## 2. Kafka Event Contracts

### 2.1 Scheduling Event (Setting Service $\to$ Go Worker via Outbox)

- **Topic**: `setting.effective-change.scheduled`
- **Key**: `{tenantId}:{companyId}`
- **Payload**:
  ```json
  {
    "eventId": "11111111-2222-3333-4444-555555555555",
    "eventType": "setting.effective-change.scheduled",
    "timestamp": "2026-08-16T12:00:00.000Z",
    "payload": {
      "changeId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "tenantId": "f1e2d3c4-b5a6-4f7e-8d9c-0b1a2c3d4e5f",
      "companyId": "b1a2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "entityType": "GRADE",
      "operation": "CREATE",
      "effectiveAt": "2026-08-20T00:00:00.000Z"
    }
  }
  ```

---

### 2.2 Execution Command (Go Worker $\to$ Setting Service Consumer)

- **Topic**: `setting.effective-change.execute`
- **Key**: `{tenantId}:{companyId}`
- **Payload**:
  ```json
  {
    "eventId": "22222222-3333-4444-5555-666666666666",
    "eventType": "setting.effective-change.execute",
    "timestamp": "2026-08-20T00:00:00.000Z",
    "payload": {
      "changeId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "tenantId": "f1e2d3c4-b5a6-4f7e-8d9c-0b1a2c3d4e5f",
      "companyId": "b1a2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "entityType": "GRADE",
      "operation": "CREATE"
    }
  }
  ```

---

### 2.3 Master Data Domain Events (Setting Service $\to$ Downstream Domains via Outbox)

- **Topic**: `setting.master-data.events`
- **Events**:
  - `setting.grade.created`
  - `setting.grade.updated`
  - `setting.grade.deactivated`
