# Interface Contract: Company Setup Progress Query

## 1. REST Endpoint: Query Company Setup Progress

### Endpoint Specification
- **Method**: `GET`
- **Path**: `/companies/:id/setup`
- **Authentication**: JWT RS256 Bearer Token (`AuthGuard`)
- **Permissions Required**: `company:read` (`PermissionGuard`)
- **Tenant Scope**: Injected via Request Context (`tenantId`)

---

### Request Parameters
- **Path Parameter**:
  - `id` (`UUID`, required): The target Company ID.

---

### Response Schema

#### Success Response: `200 OK`
```json
{
  "success": true,
  "data": {
    "companyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "status": "PENDING",
    "totalSteps": 8,
    "completedSteps": 3,
    "isEligibleForActivation": false,
    "incompleteSteps": [
      "GRADE",
      "JOB_TITLE",
      "ROLE",
      "EMPLOYEE_IMPORT",
      "POC"
    ],
    "steps": [
      {
        "stepType": "COMPANY_INFORMATION",
        "stepOrder": 1,
        "status": "COMPLETED",
        "completedAt": "2026-08-10T10:00:00.000Z",
        "completedBy": "a1b2c3d4-0000-0000-0000-000000000001",
        "externalReferenceId": null,
        "metadata": {}
      },
      {
        "stepType": "LOCATION",
        "stepOrder": 2,
        "status": "COMPLETED",
        "completedAt": "2026-08-10T10:05:00.000Z",
        "completedBy": "a1b2c3d4-0000-0000-0000-000000000001",
        "externalReferenceId": null,
        "metadata": {}
      },
      {
        "stepType": "DEPARTMENT",
        "stepOrder": 3,
        "status": "COMPLETED",
        "completedAt": "2026-08-10T10:10:00.000Z",
        "completedBy": "a1b2c3d4-0000-0000-0000-000000000001",
        "externalReferenceId": null,
        "metadata": {}
      },
      {
        "stepType": "GRADE",
        "stepOrder": 4,
        "status": "INCOMPLETE",
        "completedAt": null,
        "completedBy": null,
        "externalReferenceId": null,
        "metadata": {}
      },
      {
        "stepType": "JOB_TITLE",
        "stepOrder": 5,
        "status": "INCOMPLETE",
        "completedAt": null,
        "completedBy": null,
        "externalReferenceId": null,
        "metadata": {}
      },
      {
        "stepType": "ROLE",
        "stepOrder": 6,
        "status": "INCOMPLETE",
        "completedAt": null,
        "completedBy": null,
        "externalReferenceId": null,
        "metadata": {}
      },
      {
        "stepType": "EMPLOYEE_IMPORT",
        "stepOrder": 7,
        "status": "INCOMPLETE",
        "completedAt": null,
        "completedBy": null,
        "externalReferenceId": null,
        "metadata": {}
      },
      {
        "stepType": "POC",
        "stepOrder": 8,
        "status": "INCOMPLETE",
        "completedAt": null,
        "completedBy": null,
        "externalReferenceId": null,
        "metadata": {}
      }
    ]
  }
}
```

---

#### Error Responses

##### `404 Not Found` (Company not found or belonging to different tenant)
```json
{
  "statusCode": 404,
  "message": "Company with ID '3fa85f64-5717-4562-b3fc-2c963f66afa6' not found for this tenant",
  "error": "Not Found"
}
```

##### `401 Unauthorized`
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

##### `403 Forbidden`
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

---

## 2. Kafka Event Consumer Contracts

### 1. `authorization.role-copy.completed` / `authorization.role-setup.completed`
- **Topic**: `authorization.role-copy.completed` (or configured topic)
- **Key**: `targetCompanyId` (UUID)
- **Payload**:
```json
{
  "eventId": "e1-uuid",
  "eventType": "authorization.role-copy.completed",
  "tenantId": "t1-uuid",
  "sourceCompanyId": "c1-uuid",
  "targetCompanyId": "c2-uuid",
  "batchId": "role-batch-123",
  "copiedRoleCount": 12,
  "timestamp": "2026-08-16T12:00:00.000Z"
}
```

### 2. `employee-import.batch.completed`
- **Topic**: `employee-import.batch.completed`
- **Key**: `companyId` (UUID)
- **Payload**:
```json
{
  "eventId": "e2-uuid",
  "eventType": "employee-import.batch.completed",
  "tenantId": "t1-uuid",
  "companyId": "c2-uuid",
  "batchId": "import-batch-456",
  "importedCount": 50,
  "timestamp": "2026-08-16T12:05:00.000Z"
}
```
