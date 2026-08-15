# Interface Contracts: Company Information Completion

## 1. REST API Contract

### Update Company Information Endpoint

* **Method & Route**: `PATCH /companies/:id/information`
* **Security & Auth**: Requires Bearer JWT with Tenant Administrator privileges (`@RequirePermission('company:update')`).
* **Headers**:
  * `Authorization`: `Bearer <token>` (Required)
  * `Idempotency-Key`: `<uuid-or-string>` (Optional, recommended for network retries)
* **Path Parameters**:
  * `id` (`UUID`, Required): Target Company Identifier

#### Request Body (`UpdateCompanyInformationDto`)

```json
{
  "name": "Acme Global Solutions Pte Ltd",
  "legalName": "Acme Global Solutions Pte Ltd",
  "displayName": "Acme Solutions",
  "registrationNumber": "202612345M",
  "taxRegistrationNumber": "TAX-99887766",
  "countryCode": "SG",
  "currencyCode": "SGD",
  "timezone": "Asia/Singapore",
  "locale": "en-SG",
  "legalAddress": {
    "street": "12 Marina Boulevard, Marina Bay Financial Centre Tower 3",
    "city": "Singapore",
    "postalCode": "018982",
    "country": "Singapore"
  }
}
```

#### Response (`200 OK`)

```json
{
  "success": true,
  "data": {
    "id": "e6a4b123-5678-4321-9abc-def012345678",
    "tenantId": "c1f3a987-1234-5678-9abc-def012345678",
    "companyCode": "ACME_SG",
    "legalName": "Acme Global Solutions Pte Ltd",
    "displayName": "Acme Solutions",
    "status": "pending",
    "isTemplate": false,
    "registrationNumber": "202612345M",
    "taxRegistrationNumber": "TAX-99887766",
    "countryCode": "SG",
    "currencyCode": "SGD",
    "timezone": "Asia/Singapore",
    "locale": "en-SG",
    "createdAt": "2026-08-15T10:00:00.000Z",
    "updatedAt": "2026-08-15T10:30:00.000Z",
    "setupSteps": [
      {
        "stepType": "COMPANY_INFORMATION",
        "stepOrder": 1,
        "status": "completed",
        "completedAt": "2026-08-15T10:30:00.000Z",
        "completedBy": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
        "externalReferenceId": null,
        "metadata": {}
      },
      {
        "stepType": "LOCATION",
        "stepOrder": 2,
        "status": "incomplete",
        "completedAt": null,
        "completedBy": null,
        "externalReferenceId": null,
        "metadata": {}
      }
    ]
  }
}
```

#### Error Responses

- `400 Bad Request`: Input validation failed (invalid ISO currency/country code, invalid timezone, or malformed body).
- `401 Unauthorized`: Missing or invalid JWT.
- `403 Forbidden`: Authenticated user lacks required administrator permission.
- `404 Not Found`: Target company does not exist within the caller's tenant.
- `422 Unprocessable Entity`: Company is in an invalid lifecycle status (e.g., archived/deleted).

---

## 2. Asynchronous Domain Events Contract

### Event: `company.updated`

* **Topic**: `setting.company.events`
* **Trigger**: Emitted atomically via Transactional Outbox whenever company information is saved.
* **Partition Key**: `{tenantId}:{companyId}`

#### Event Envelope & Payload

```json
{
  "eventId": "f9a8b7c6-d5e4-3210-fedc-ba9876543210",
  "eventType": "company.updated",
  "aggregateType": "COMPANY",
  "aggregateId": "e6a4b123-5678-4321-9abc-def012345678",
  "timestamp": "2026-08-15T10:30:00.000Z",
  "version": "1.0.0",
  "tenantId": "c1f3a987-1234-5678-9abc-def012345678",
  "correlationId": "req-12345-67890",
  "payload": {
    "companyId": "e6a4b123-5678-4321-9abc-def012345678",
    "tenantId": "c1f3a987-1234-5678-9abc-def012345678",
    "companyCode": "ACME_SG",
    "legalName": "Acme Global Solutions Pte Ltd",
    "displayName": "Acme Solutions",
    "status": "pending",
    "countryCode": "SG",
    "currencyCode": "SGD",
    "timezone": "Asia/Singapore",
    "informationCompleted": true,
    "informationCompletedAt": "2026-08-15T10:30:00.000Z",
    "informationCompletedBy": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "updatedAt": "2026-08-15T10:30:00.000Z"
  }
}
```
