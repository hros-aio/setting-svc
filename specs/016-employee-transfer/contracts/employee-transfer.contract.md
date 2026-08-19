# API & Message Contracts: Employee Transfer Between Companies

**Feature**: Employee Transfer Between Companies  
**Branch**: `016-employee-transfer`  
**Date**: 2026-08-19

## 1. REST Endpoints

All endpoints are authenticated with JWT RS256 (`AuthGuard`) and RBAC permissions (`PermissionGuard`), scoped by `tenant_id` and `company_id` where applicable.

---

### Endpoint 1: Initiate Employee Transfer

Initiates and schedules a pending inter-company transfer for an employee.

- **Method**: `POST`
- **Path**: `/employee-transfers`
- **Permission**: `employee-transfer:create` (or `admin`)
- **Rate Limit**: 60 req/min

#### Request Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Authorization` | String | Yes | `Bearer <jwt>` |
| `Content-Type` | String | Yes | `application/json` |
| `x-tenant-id` | UUID | Optional | Active Tenant ID (or in body / JWT context) |

#### Request Body

```json
{
  "companyId": "33333333-3333-3333-3333-333333333333",
  "employeeId": "22222222-2222-2222-2222-222222222222",
  "destinationCompanyId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "destinationLocationId": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
  "destinationDepartmentId": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
  "destinationGradeId": "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a",
  "destinationJobTitleId": "e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b",
  "effectiveAt": "2026-08-25T00:00:00.000Z",
  "notes": "Transfer to Regional Office operations team"
}
```

#### Success Response: `201 Created`

```json
{
  "id": "f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c",
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "employeeId": "22222222-2222-2222-2222-222222222222",
  "sourceCompanyId": "33333333-3333-3333-3333-333333333333",
  "destinationCompanyId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "destinationLocationId": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
  "destinationDepartmentId": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
  "destinationGradeId": "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a",
  "destinationJobTitleId": "e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b",
  "status": "PENDING",
  "effectiveAt": "2026-08-25T00:00:00.000Z",
  "completedAt": null,
  "notes": "Transfer to Regional Office operations team",
  "createdAt": "2026-08-19T22:30:00.000Z",
  "updatedAt": "2026-08-19T22:30:00.000Z"
}
```

#### Error Responses

- **`400 Bad Request`**:
  ```json
  {
    "statusCode": 400,
    "errorCode": "INVALID_EFFECTIVE_DATE",
    "message": "Effective date must be greater than or equal to the end of the current business day"
  }
  ```
- **`404 Not Found`**:
  ```json
  {
    "statusCode": 404,
    "errorCode": "DESTINATION_COMPANY_NOT_FOUND",
    "message": "Destination company not found or not in ACTIVE status"
  }
  ```
- **`409 Conflict`**:
  ```json
  {
    "statusCode": 409,
    "errorCode": "PENDING_TRANSFER_EXISTS",
    "message": "Employee already has an active pending transfer"
  }
  ```
- **`422 Unprocessable Entity`**:
  ```json
  {
    "statusCode": 422,
    "errorCode": "CROSS_COMPANY_REFERENCE_VIOLATION",
    "message": "Job title does not belong to destination company or is inactive"
  }
  ```

---

### Endpoint 2: Get Pending Transfer for Employee

Fetches the active pending transfer for an employee if one exists.

- **Method**: `GET`
- **Path**: `/employee-transfers/pending`
- **Permission**: `employee-transfer:read`

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `employeeId` | UUID | Yes | Employee ID |
| `companyId` | UUID | No | Company ID |
| `tenantId` | UUID | No | Tenant ID |

#### Success Response: `200 OK` (Pending exists)

```json
{
  "id": "f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c",
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "employeeId": "22222222-2222-2222-2222-222222222222",
  "sourceCompanyId": "33333333-3333-3333-3333-333333333333",
  "destinationCompanyId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "status": "PENDING",
  "effectiveAt": "2026-08-25T00:00:00.000Z",
  "createdAt": "2026-08-19T22:30:00.000Z"
}
```

#### Success Response: `200 OK` (No pending transfer)

```json
null
```

---

### Endpoint 3: Get Employee Transfer History

Fetches the historical timeline of all transfers for an employee across the tenant.

- **Method**: `GET`
- **Path**: `/employee-transfers/history`
- **Permission**: `employee-transfer:read`

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `employeeId` | UUID | Yes | - | Employee ID |
| `tenantId` | UUID | No | - | Tenant ID |
| `limit` | Integer | No | 20 | Page size |
| `offset` | Integer | No | 0 | Page offset |

#### Success Response: `200 OK`

```json
{
  "items": [
    {
      "id": "f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c",
      "employeeId": "22222222-2222-2222-2222-222222222222",
      "sourceCompanyId": "33333333-3333-3333-3333-333333333333",
      "sourceCompanyName": "Acme Holdings",
      "destinationCompanyId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "destinationCompanyName": "Acme Logistics",
      "status": "COMPLETED",
      "effectiveAt": "2026-07-01T00:00:00.000Z",
      "completedAt": "2026-07-01T00:00:02.100Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

## 2. Kafka Event Contracts

### Topic: `setting.effective-change.scheduled`
- **Producer**: Setting Service (Transactional Outbox)
- **Consumer**: Go Scheduler Worker (`setting-effective-worker-go`)

```json
{
  "id": "event-uuid",
  "type": "setting.effective-change.scheduled",
  "source": "setting-service",
  "datacontenttype": "application/json",
  "time": "2026-08-19T22:30:00.000Z",
  "data": {
    "transferId": "f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c",
    "changeType": "EMPLOYEE_TRANSFER",
    "tenantId": "11111111-1111-1111-1111-111111111111",
    "companyId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "employeeId": "22222222-2222-2222-2222-222222222222",
    "effectiveAt": "2026-08-25T00:00:00.000Z"
  }
}
```

### Topic: `employee.company-transferred`
- **Producer**: Setting Service (Transactional Outbox upon transfer execution)
- **Consumers**: Access Service, Time & Attendance Service, Payroll Service

```json
{
  "id": "event-uuid",
  "type": "employee.company-transferred",
  "source": "setting-service",
  "datacontenttype": "application/json",
  "time": "2026-08-25T00:00:01.000Z",
  "data": {
    "transferId": "f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c",
    "tenantId": "11111111-1111-1111-1111-111111111111",
    "employeeId": "22222222-2222-2222-2222-222222222222",
    "sourceCompanyId": "33333333-3333-3333-3333-333333333333",
    "destinationCompanyId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "destinationLocationId": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
    "destinationDepartmentId": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
    "destinationGradeId": "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a",
    "destinationJobTitleId": "e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b",
    "effectiveAt": "2026-08-25T00:00:00.000Z",
    "completedAt": "2026-08-25T00:00:01.234Z",
    "continuousEmployment": true
  }
}
```
