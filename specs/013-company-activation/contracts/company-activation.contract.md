# API Contract: Company Activation Endpoint

## 1. REST Endpoint: `POST /companies/:id/activate`

Explicitly triggers the activation of a company in `PENDING` status if all 8 mandatory setup steps are completed.

### Authentication & Authorization
- **Headers**:
  - `Authorization: Bearer <RS256-JWT>`
  - `x-tenant-code: <TENANT_CODE>` (or derived from JWT)
  - `idempotency-key: <OPTIONAL_UUID>`
- **Guard**: `AuthGuard`, `PermissionGuard`
- **Required Permission / Role**: `@RequirePermission('company:activate')` (or Administrator role)

---

### Request

- **Path Parameters**:
  - `id` (string, UUID, required): The UUID of the company to activate.
- **Request Body**: None (or empty object `{}`)

---

### Responses

#### 200 OK — Successful Activation
Returned when all 8 steps are complete and status transitions to `ACTIVE`.

```json
{
  "success": true,
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "tenantId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "companyCode": "VN001",
    "legalName": "Acme Vietnam Ltd",
    "displayName": "Acme Vietnam",
    "status": "ACTIVE",
    "isTemplate": false,
    "registrationNumber": "0101234567",
    "taxRegistrationNumber": "0101234567",
    "countryCode": "VN",
    "currencyCode": "VND",
    "timezone": "Asia/Ho_Chi_Minh",
    "locale": "vi-VN",
    "legalAddress": {
      "street": "123 Le Loi",
      "city": "Ho Chi Minh",
      "country": "Vietnam"
    },
    "informationCompletedAt": "2026-08-17T10:00:00.000Z",
    "informationCompletedBy": "550e8400-e29b-41d4-a716-446655440000",
    "activatedAt": "2026-08-17T12:00:00.000Z",
    "activatedBy": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2026-08-17T09:00:00.000Z",
    "updatedAt": "2026-08-17T12:00:00.000Z",
    "setupSteps": [
      {
        "stepType": "COMPANY_INFORMATION",
        "stepOrder": 1,
        "status": "COMPLETED",
        "completedAt": "2026-08-17T10:00:00.000Z",
        "completedBy": "550e8400-e29b-41d4-a716-446655440000",
        "externalReferenceId": null,
        "metadata": {}
      }
    ]
  }
}
```

---

#### 422 Unprocessable Entity — Activation Rejected (Incomplete Steps)
Returned when one or more setup steps are not completed.

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Company activation rejected: mandatory setup steps are incomplete.",
  "incompleteSteps": [
    "DEPARTMENT",
    "EMPLOYEE_IMPORT"
  ]
}
```

---

#### 422 Unprocessable Entity / 409 Conflict — Already Active
Returned when the company is already in `ACTIVE` status.

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Company is already in ACTIVE status and cannot be re-activated"
}
```

---

#### 404 Not Found
Returned when the company does not exist or does not belong to the authenticated tenant.

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Company with ID '7c9e6679-7425-40de-944b-e07fc1f90ae7' not found for this tenant"
}
```

---

#### 403 Forbidden
Returned when the caller does not have sufficient permissions.

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Forbidden resource"
}
```

---

## 2. Kafka Event Contract: `company.activated`

### Topic: `setting.company.events`
- **Key**: `${tenantId}:${companyId}`
- **Payload Schema**:

```json
{
  "eventId": "3c9e6679-7425-40de-944b-e07fc1f90ae7",
  "eventType": "company.activated",
  "aggregateType": "company",
  "aggregateId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "tenantId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  "timestamp": "2026-08-17T12:00:00.000Z",
  "payload": {
    "companyId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "tenantId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "companyCode": "VN001",
    "displayName": "Acme Vietnam",
    "legalName": "Acme Vietnam Ltd",
    "status": "ACTIVE",
    "activatedAt": "2026-08-17T12:00:00.000Z",
    "activatedBy": "550e8400-e29b-41d4-a716-446655440000",
    "completedStepsCount": 8
  }
}
```
