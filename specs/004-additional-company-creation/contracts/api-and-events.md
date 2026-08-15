# API & Event Contracts: Additional Company Creation

## 1. REST API Endpoints

### POST `/companies`
Creates a new company entity within the tenant context.

#### Request Headers
- `Authorization`: `Bearer <JWT_TOKEN>` (Tenant Admin)
- `X-Tenant-ID`: `<UUID>` (or extracted from JWT)
- `Idempotency-Key`: `<string>` (Optional, recommended for retries)

#### Request Body (`CreateCompanyDto`)
```json
{
  "companyCode": "ACME_US",
  "name": "Acme US Inc",
  "legalName": "Acme United States Incorporated",
  "taxId": "US-987654321",
  "currency": "USD",
  "timezone": "America/New_York",
  "country": "US",
  "copyFromDefault": true,
  "copyCategories": [
    "GRADES",
    "JOB_TITLES",
    "ROLES",
    "ORGANIZATION_RESPONSIBILITIES"
  ]
}
```

#### Response: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "7b08ec84-93be-4e08-bfb1-df4b01e3b6aa",
    "tenantId": "c4d7e2f1-5a3b-4c2d-9e8f-1a2b3c4d5e6f",
    "companyCode": "ACME_US",
    "name": "Acme US Inc",
    "legalName": "Acme United States Incorporated",
    "taxId": "US-987654321",
    "currency": "USD",
    "timezone": "America/New_York",
    "country": "US",
    "status": "PENDING",
    "isTemplate": false,
    "createdAt": "2026-08-15T14:30:00.000Z",
    "updatedAt": "2026-08-15T14:30:00.000Z",
    "setupSteps": [
      {
        "stepType": "COMPANY_INFORMATION",
        "status": "INCOMPLETE"
      },
      {
        "stepType": "LOCATION",
        "status": "INCOMPLETE"
      },
      {
        "stepType": "DEPARTMENT",
        "status": "INCOMPLETE"
      },
      {
        "stepType": "GRADE",
        "status": "COMPLETED",
        "completedAt": "2026-08-15T14:30:00.000Z",
        "metadata": { "completedViaCopy": true }
      },
      {
        "stepType": "JOB_TITLE",
        "status": "COMPLETED",
        "completedAt": "2026-08-15T14:30:00.000Z",
        "metadata": { "completedViaCopy": true }
      },
      {
        "stepType": "ROLE",
        "status": "INCOMPLETE"
      },
      {
        "stepType": "EMPLOYEE_IMPORT",
        "status": "INCOMPLETE"
      },
      {
        "stepType": "ORGANIZATION_RESPONSIBILITY",
        "status": "COMPLETED",
        "completedAt": "2026-08-15T14:30:00.000Z",
        "metadata": { "completedViaCopy": true }
      }
    ]
  }
}
```

#### Error Responses
- `400 Bad Request`: Validation failure on input parameters.
- `409 Conflict`: Company code already exists for the tenant.
- `422 Unprocessable Entity`: `copyFromDefault: true` requested, but no default template company exists.

---

## 2. Kafka Event Contracts

### 2.1 Outgoing: `setting.company.events` (`company.created`)
```json
{
  "eventId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventType": "company.created",
  "eventVersion": "1.0",
  "timestamp": "2026-08-15T14:30:00.000Z",
  "tenantId": "c4d7e2f1-5a3b-4c2d-9e8f-1a2b3c4d5e6f",
  "companyId": "7b08ec84-93be-4e08-bfb1-df4b01e3b6aa",
  "correlationId": "corr-uuid-1234",
  "payload": {
    "companyId": "7b08ec84-93be-4e08-bfb1-df4b01e3b6aa",
    "tenantId": "c4d7e2f1-5a3b-4c2d-9e8f-1a2b3c4d5e6f",
    "companyCode": "ACME_US",
    "companyName": "Acme US Inc",
    "status": "PENDING",
    "createdAt": "2026-08-15T14:30:00.000Z"
  }
}
```

### 2.2 Outgoing: `authorization.role-copy.requested`
```json
{
  "eventId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "eventType": "authorization.role-copy.requested",
  "eventVersion": "1.0",
  "timestamp": "2026-08-15T14:30:00.000Z",
  "tenantId": "c4d7e2f1-5a3b-4c2d-9e8f-1a2b3c4d5e6f",
  "companyId": "7b08ec84-93be-4e08-bfb1-df4b01e3b6aa",
  "correlationId": "corr-uuid-1234",
  "payload": {
    "tenantId": "c4d7e2f1-5a3b-4c2d-9e8f-1a2b3c4d5e6f",
    "sourceCompanyId": "11111111-2222-3333-4444-555555555555",
    "targetCompanyId": "7b08ec84-93be-4e08-bfb1-df4b01e3b6aa"
  }
}
```

### 2.3 Incoming: `authorization.role-copy.completed`
```json
{
  "eventId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "eventType": "authorization.role-copy.completed",
  "eventVersion": "1.0",
  "timestamp": "2026-08-15T14:30:05.000Z",
  "tenantId": "c4d7e2f1-5a3b-4c2d-9e8f-1a2b3c4d5e6f",
  "companyId": "7b08ec84-93be-4e08-bfb1-df4b01e3b6aa",
  "correlationId": "corr-uuid-1234",
  "payload": {
    "batchId": "role-batch-999",
    "tenantId": "c4d7e2f1-5a3b-4c2d-9e8f-1a2b3c4d5e6f",
    "sourceCompanyId": "11111111-2222-3333-4444-555555555555",
    "targetCompanyId": "7b08ec84-93be-4e08-bfb1-df4b01e3b6aa",
    "copiedRoleCount": 8
  }
}
```
