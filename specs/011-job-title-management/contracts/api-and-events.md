# Interface Contracts: Job Title Management

## 1. REST API Endpoints

All endpoints are protected by `AuthGuard` and `PermissionGuard`. Multi-tenant and company context is extracted from headers (`RequestContextService` & JWT auth context).

### 1.1 Create and Schedule Job Title

- **Method / Path**: `POST /job-titles`
- **Permission**: `job-title:create`
- **Status Code**: `201 Created`

**Request Body (`CreateJobTitleDto`):**
```json
{
  "code": "ENG-SENIOR",
  "name": "Senior Software Engineer",
  "departmentId": "48b61c94-0f19-482a-a92c-56747df32a81",
  "gradeId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "description": "Leads engineering development and architecture",
  "effectiveAt": "2026-08-17T23:59:59.000Z"
}
```

**Response (`JobTitleEntity`):**
```json
{
  "id": "e0e85499-4d6d-47fb-94f4-6cb0a4c28f11",
  "tenantId": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
  "companyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "departmentId": "48b61c94-0f19-482a-a92c-56747df32a81",
  "gradeId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "code": "ENG-SENIOR",
  "name": "Senior Software Engineer",
  "description": "Leads engineering development and architecture",
  "status": "scheduled",
  "effectiveAt": "2026-08-17T23:59:59.000Z",
  "createdAt": "2026-08-16T15:45:00.000Z",
  "updatedAt": "2026-08-16T15:45:00.000Z"
}
```

---

### 1.2 Query Job Titles (List)

- **Method / Path**: `GET /job-titles`
- **Permission**: `job-title:read`
- **Status Code**: `200 OK`

**Query Parameters (`QueryJobTitleDto`):**
- `status`: `'active' | 'scheduled' | 'inactive'` (default: `'active'`)
- `departmentId`: UUID (optional filter)
- `gradeId`: UUID (optional filter)
- `page`: number (default: 1)
- `limit`: number (default: 20)
- `search`: string (optional query across name/code)

**Response:**
```json
{
  "items": [
    {
      "id": "e0e85499-4d6d-47fb-94f4-6cb0a4c28f11",
      "code": "ENG-SENIOR",
      "name": "Senior Software Engineer",
      "departmentId": "48b61c94-0f19-482a-a92c-56747df32a81",
      "gradeId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "status": "active",
      "effectiveAt": "2026-08-17T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

### 1.3 Get Job Title by ID (with Pending Change Projection)

- **Method / Path**: `GET /job-titles/:id`
- **Permission**: `job-title:read`
- **Status Code**: `200 OK`

**Response (`JobTitleWithPendingChange`):**
```json
{
  "id": "e0e85499-4d6d-47fb-94f4-6cb0a4c28f11",
  "code": "ENG-SENIOR",
  "name": "Senior Software Engineer",
  "departmentId": "48b61c94-0f19-482a-a92c-56747df32a81",
  "gradeId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "active",
  "effectiveAt": "2026-08-17T00:00:00.000Z",
  "pendingChange": {
    "id": "7b0a7b7a-9a64-44b4-bbef-62e92c21966a",
    "operation": "UPDATE",
    "status": "scheduled",
    "effectiveAt": "2026-09-01T00:00:00.000Z",
    "payload": {
      "name": "Lead Software Engineer"
    }
  }
}
```

---

### 1.4 Schedule Job Title Update

- **Method / Path**: `PATCH /job-titles/:id`
- **Permission**: `job-title:update`
- **Status Code**: `200 OK`

**Request Body (`UpdateJobTitleDto`):**
```json
{
  "name": "Staff Software Engineer",
  "departmentId": "48b61c94-0f19-482a-a92c-56747df32a81",
  "gradeId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  "description": "Expanded scope across engineering pods",
  "effectiveAt": "2026-09-01T23:59:59.000Z"
}
```

**Response (`EffectiveChangeEntity`):**
```json
{
  "id": "7b0a7b7a-9a64-44b4-bbef-62e92c21966a",
  "tenantId": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
  "companyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "entityType": "job_title",
  "entityId": "e0e85499-4d6d-47fb-94f4-6cb0a4c28f11",
  "operation": "UPDATE",
  "payload": {
    "name": "Staff Software Engineer",
    "gradeId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
  },
  "status": "scheduled",
  "effectiveAt": "2026-09-01T23:59:59.000Z"
}
```

---

### 1.5 Schedule Job Title Deactivation

- **Method / Path**: `POST /job-titles/:id/deactivate`
- **Permission**: `job-title:deactivate`
- **Status Code**: `200 OK`

**Request Body (`DeactivateJobTitleDto`):**
```json
{
  "effectiveAt": "2026-10-01T23:59:59.000Z"
}
```

**Response (`EffectiveChangeEntity`):**
```json
{
  "id": "8f3b2e1a-4c5d-6e7f-8a9b-0c1d2e3f4a5b",
  "tenantId": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
  "companyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "entityType": "job_title",
  "entityId": "e0e85499-4d6d-47fb-94f4-6cb0a4c28f11",
  "operation": "DEACTIVATE",
  "payload": {},
  "status": "scheduled",
  "effectiveAt": "2026-10-01T23:59:59.000Z"
}
```

---

## 2. Asynchronous Event Contracts

### 2.1 Outbox Scheduling Event (`setting.effective-change.scheduled`)

Published atomically upon create, update, or deactivate scheduling.

- **Topic**: `setting.effective-change.scheduled`
- **Partition Key**: `{tenantId}:{companyId}`
- **Payload**:
```json
{
  "changeId": "e0e85499-4d6d-47fb-94f4-6cb0a4c28f11",
  "entityType": "job_title",
  "operation": "CREATE",
  "effectiveAt": "2026-08-17T23:59:59.000Z",
  "targetCompanyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "tenantId": "c9bf9e57-1685-4c89-bafb-ff5af830be8a"
}
```

### 2.2 Inbound Execution Command (`setting.effective-change.execute`)

Received from Go Worker at effective time.

- **Topic**: `setting.effective-change.execute`
- **Payload**:
```json
{
  "eventId": "exec-msg-uuid-12345",
  "changeId": "e0e85499-4d6d-47fb-94f4-6cb0a4c28f11",
  "entityType": "job_title",
  "operation": "CREATE",
  "targetCompanyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "tenantId": "c9bf9e57-1685-4c89-bafb-ff5af830be8a"
}
```

### 2.3 Master Data Public Events (`setting.master-data.events`)

Published by `JobTitleApplyHandler` upon state execution for downstream consumers (Directory, Org Chart, Payroll).

- **Topic**: `setting.master-data.events`
- **Event Types**:
  - `setting.job-title.created`
  - `setting.job-title.updated`
  - `setting.job-title.deactivated`
- **Payload**:
```json
{
  "eventId": "evt-uuid-54321",
  "eventType": "setting.job-title.created",
  "timestamp": "2026-08-17T23:59:59.000Z",
  "tenantId": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
  "companyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "data": {
    "jobTitleId": "e0e85499-4d6d-47fb-94f4-6cb0a4c28f11",
    "code": "ENG-SENIOR",
    "name": "Senior Software Engineer",
    "departmentId": "48b61c94-0f19-482a-a92c-56747df32a81",
    "gradeId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "status": "active"
  }
}
```
