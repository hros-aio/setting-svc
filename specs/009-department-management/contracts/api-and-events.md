# API & Event Contracts: Department Management

**Feature**: Department Management  
**Branch**: `009-department-management`  
**Date**: 2026-08-16  

---

## 1. REST API Endpoints

All endpoints are authenticated with JWT RS256 and scoped to the caller's authorized tenant and company context.

### 1.1 `POST /departments` (Create & Schedule Department)

Creates a new department in `scheduled` status and emits an outbox scheduling event.

- **Headers**:
  - `Authorization: Bearer <jwt>`
  - `x-tenant-id: <uuid>` (or derived from JWT)
  - `x-company-id: <uuid>` (or derived from JWT)

- **Request Body (`CreateDepartmentDto`)**:
  ```json
  {
    "code": "ENG-BACKEND",
    "name": "Backend Engineering",
    "description": "Core platform and backend engineering team",
    "parentDepartmentId": "c6a1b2c3-d4e5-4f6a-8b9c-0d1e2f3a4b5c",
    "effectiveAt": "2026-08-20T00:00:00.000Z"
  }
  ```

- **Responses**:
  - `201 Created`:
    ```json
    {
      "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "tenantId": "f1e2d3c4-b5a6-4f7e-8d9c-0b1a2c3d4e5f",
      "companyId": "b1a2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "code": "ENG-BACKEND",
      "name": "Backend Engineering",
      "description": "Core platform and backend engineering team",
      "parentDepartmentId": "c6a1b2c3-d4e5-4f6a-8b9c-0d1e2f3a4b5c",
      "status": "scheduled",
      "effectiveAt": "2026-08-20T00:00:00.000Z",
      "createdAt": "2026-08-16T12:00:00.000Z",
      "updatedAt": "2026-08-16T12:00:00.000Z"
    }
    ```
  - `400 Bad Request`: Invalid DTO, past effective date, self-parent reference.
  - `404 Not Found`: Parent department not found or belongs to another company.
  - `409 Conflict`: Duplicate department code within company.

---

### 1.2 `PATCH /departments/:id` (Schedule Department Update)

Schedules modifications for an active department in `effective_changes` without altering the active master row before the effective date.

- **Request Body (`UpdateDepartmentDto`)**:
  ```json
  {
    "name": "Platform & Backend Engineering",
    "parentDepartmentId": "d7b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    "effectiveAt": "2026-08-25T00:00:00.000Z"
  }
  ```

- **Responses**:
  - `200 OK`:
    ```json
    {
      "changeId": "e8c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
      "departmentId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "status": "scheduled",
      "effectiveAt": "2026-08-25T00:00:00.000Z",
      "payload": {
        "name": "Platform & Backend Engineering",
        "parentDepartmentId": "d7b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"
      }
    }
    ```
  - `400 Bad Request`: Invalid payload / effective date.
  - `404 Not Found`: Target department or proposed parent not found.
  - `409 Conflict`: Pending change already exists (`BR-13`) OR circular hierarchy detected.

---

### 1.3 `POST /departments/:id/deactivate` (Schedule Department Deactivation)

Schedules the deactivation of an active department.

- **Request Body (`DeactivateDepartmentDto`)**:
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
      "departmentId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "status": "scheduled",
      "effectiveAt": "2026-08-30T00:00:00.000Z"
    }
    ```
  - `409 Conflict`: Pending change already exists or department already inactive.

---

### 1.4 `GET /departments` (List Active Departments)

Retrieves active departments for the caller's company. Supports pagination and hierarchical tree or flat view.

- **Query Parameters (`QueryDepartmentDto`)**:
  - `page`: number (default 1)
  - `limit`: number (default 20, max 100)
  - `asTree`: boolean (optional, returns nested parent-children tree structure)
  - `search`: string (optional search on name/code)

- **Responses**:
  - `200 OK`:
    ```json
    {
      "items": [
        {
          "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
          "code": "ENG",
          "name": "Engineering",
          "parentDepartmentId": null,
          "status": "active",
          "children": [
            {
              "id": "c6a1b2c3-d4e5-4f6a-8b9c-0d1e2f3a4b5c",
              "code": "ENG-BACKEND",
              "name": "Backend Engineering",
              "parentDepartmentId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
              "status": "active"
            }
          ]
        }
      ],
      "total": 1,
      "page": 1,
      "limit": 20
    }
    ```

---

### 1.5 `GET /departments/:id` (Get Department Details)

- **Responses**:
  - `200 OK`: Returns complete department details, ancestor chain summary, and pending change info if any.
  - `404 Not Found`: Department does not exist in the caller's company.

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
      "entityType": "DEPARTMENT",
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
      "entityType": "DEPARTMENT",
      "operation": "CREATE"
    }
  }
  ```

---

### 2.3 Master Data Domain Events (Setting Service $\to$ Downstream Domains via Outbox)

- **Topic**: `setting.master-data.events`
- **Events**:
  - `setting.department.created`
  - `setting.department.updated`
  - `setting.department.deactivated`
