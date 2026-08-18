# API Contract: Organization Responsibility (Point of Contact) Management

## 1. Authentication & Security
- **Authentication**: Bearer JWT token (`RS256` signed).
- **Guards**: `AuthGuard`, `PermissionGuard`.
- **Tenant & Company Context**: Sourced from `AuthContext` (`tenantId`, `companyId` / route param validated against user scope).
- **Roles / Permissions**:
  - Read endpoints (`GET`): `poc:read` (Administrator, HR Business User)
  - Write endpoints (`POST`, `PUT`, `DELETE`): `poc:create`, `poc:update`, `poc:deactivate` (Administrator)

---

## 2. Endpoints

### 2.1. Initial PoC Assignment
**Route**: `POST /companies/:companyId/pocs`  
**Permission**: `poc:create`

#### Request
- **Headers**:
  - `Authorization: Bearer <JWT>`
  - `Content-Type: application/json`
- **Path Parameters**:
  - `companyId` (UUID, required): Target company ID.
- **Body**:
```json
{
  "pocType": "HR_HEAD",
  "employeeId": "550e8400-e29b-41d4-a716-446655440000",
  "effectiveAt": "2026-08-20T00:00:00.000Z"
}
```

#### Response: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "tenantId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "companyId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "pocType": "HR_HEAD",
    "employeeId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "scheduled",
    "effectiveAt": "2026-08-20T00:00:00.000Z",
    "createdAt": "2026-08-18T12:00:00.000Z",
    "updatedAt": "2026-08-18T12:00:00.000Z"
  }
}
```

#### Error Responses
- `400 Bad Request`: Invalid `pocType` not in allow-list, invalid UUID format, or `effectiveAt` not in future ($\ge$ next business day).
- `404 Not Found`: Referenced `employeeId` does not exist in `employee_references` or is inactive.
- `409 Conflict`: An active or scheduled PoC of this `pocType` already exists for this company.

---

### 2.2. Replace Point of Contact (Effective-Dated)
**Route**: `PUT /companies/:companyId/pocs/:pocId/replace`  
**Permission**: `poc:update`

#### Request
- **Path Parameters**:
  - `companyId` (UUID, required)
  - `pocId` (UUID, required): The current active PoC assignment ID.
- **Body**:
```json
{
  "newEmployeeId": "660e8400-e29b-41d4-a716-446655440111",
  "effectiveAt": "2026-08-25T00:00:00.000Z",
  "reason": "Leadership succession"
}
```

#### Response: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "e4f8d22b-8a71-4a22-9214-998877665544",
    "tenantId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "companyId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "entityType": "poc",
    "entityId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "changeType": "UPDATE",
    "payload": {
      "newEmployeeId": "660e8400-e29b-41d4-a716-446655440111",
      "reason": "Leadership succession"
    },
    "effectiveAt": "2026-08-25T00:00:00.000Z",
    "status": "scheduled",
    "createdAt": "2026-08-18T12:05:00.000Z",
    "updatedAt": "2026-08-18T12:05:00.000Z"
  }
}
```

#### Error Responses
- `404 Not Found`: Target PoC does not exist or new employee reference not found.
- `409 Conflict`: Target PoC already has a pending effective change.

---

### 2.3. Deactivate Point of Contact (Effective-Dated)
**Route**: `DELETE /companies/:companyId/pocs/:pocId`  
**Permission**: `poc:deactivate`

#### Request
- **Path Parameters**:
  - `companyId` (UUID, required)
  - `pocId` (UUID, required)
- **Body**:
```json
{
  "effectiveAt": "2026-08-30T00:00:00.000Z",
  "reason": "Role restructuring"
}
```

#### Response: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "f5a9e33c-9b82-4b33-8325-001122334455",
    "tenantId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "companyId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "entityType": "poc",
    "entityId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "changeType": "DEACTIVATE",
    "payload": {
      "reason": "Role restructuring"
    },
    "effectiveAt": "2026-08-30T00:00:00.000Z",
    "status": "scheduled",
    "createdAt": "2026-08-18T12:10:00.000Z",
    "updatedAt": "2026-08-18T12:10:00.000Z"
  }
}
```

---

### 2.4. List Active PoCs (with Joined Employee Reference)
**Route**: `GET /companies/:companyId/pocs`  
**Permission**: `poc:read`

#### Response: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "pocType": "HR_HEAD",
      "employeeId": "550e8400-e29b-41d4-a716-446655440000",
      "employeeNumber": "EMP-001",
      "displayName": "Johnathan Smith",
      "employmentStatus": "ACTIVE",
      "isHolderInactive": false,
      "status": "active",
      "effectiveAt": "2026-08-15T00:00:00.000Z",
      "hasPendingChange": true,
      "pendingChange": {
        "id": "e4f8d22b-8a71-4a22-9214-998877665544",
        "changeType": "UPDATE",
        "effectiveAt": "2026-08-25T00:00:00.000Z",
        "newEmployeeId": "660e8400-e29b-41d4-a716-446655440111"
      }
    }
  ]
}
```

---

### 2.5. List PoC History & Changes
**Route**: `GET /companies/:companyId/pocs/history`  
**Permission**: `poc:read`

#### Query Parameters
- `pocType` (optional, string): Filter by responsibility type.
- `page` (optional, number, default: 1)
- `limit` (optional, number, default: 20)

#### Response: `200 OK`
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "pocType": "HR_HEAD",
        "employeeId": "550e8400-e29b-41d4-a716-446655440000",
        "displayName": "Johnathan Smith",
        "status": "inactive",
        "effectiveAt": "2026-08-01T00:00:00.000Z",
        "archivedAt": "2026-08-25T00:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```
