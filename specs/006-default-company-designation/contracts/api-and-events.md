# Interface Contracts: Default Company Designation

## 1. REST API Contract

### Transfer Default Company Endpoint

* **Method & Route**: `PUT /companies/:id/default` (also supports `PATCH /companies/:id/default`)
* **Security & Auth**: Requires Bearer JWT with Tenant Administrator privileges (`@RequirePermission('company:update')`).
* **Headers**:
  * `Authorization`: `Bearer <token>` (Required)
  * `Idempotency-Key`: `<uuid-or-string>` (Optional)
* **Path Parameters**:
  * `id` (`UUID`, Required): Target Company Identifier to designate as default

#### Request Body
* Empty / No payload required.

#### Response (`200 OK`)

```json
{
  "success": true,
  "data": {
    "id": "e6a4b123-5678-4321-9abc-def012345678",
    "tenantId": "c1f3a987-1234-5678-9abc-def012345678",
    "companyCode": "ACME_HQ",
    "legalName": "Acme Global Headquarters Pte Ltd",
    "displayName": "Acme HQ",
    "status": "active",
    "isTemplate": true,
    "registrationNumber": "202612345M",
    "taxRegistrationNumber": "TAX-99887766",
    "countryCode": "SG",
    "currencyCode": "SGD",
    "timezone": "Asia/Singapore",
    "locale": "en-SG",
    "createdAt": "2026-08-15T10:00:00.000Z",
    "updatedAt": "2026-08-15T10:35:00.000Z",
    "setupSteps": []
  }
}
```

#### Error Responses

- `400 Bad Request`: Malformed company ID parameter or invalid request context.
- `401 Unauthorized`: Missing, expired, or invalid JWT.
- `403 Forbidden`: Authenticated user lacks administrator privileges.
- `404 Not Found`: Target company does not exist within the caller's tenant.

---

## 2. Asynchronous Domain Events

* **Domain Events**: None. Default company designation is an internal configuration template marker for Setting Service; no outbox event is emitted.
