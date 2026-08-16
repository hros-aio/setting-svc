# Contracts: Location Management API & Events

## 1. REST API Endpoints

### 1.1 Create Location
- **Endpoint**: `POST /api/v1/locations`
- **Permissions**: `@Permissions('location:create')`
- **Headers**: `Authorization: Bearer <jwt>`, `X-Company-Id: <companyId>`

#### Request Body
```json
{
  "code": "HQ-TOKYO",
  "name": "Tokyo Headquarters",
  "description": "Main primary global office",
  "countryCode": "JP",
  "timezone": "Asia/Tokyo",
  "address": {
    "street": "1-1 Chiyoda",
    "city": "Tokyo",
    "postalCode": "100-0001"
  },
  "isHeadquarter": true,
  "effectiveAt": "2026-08-17T00:00:00.000Z"
}
```

#### Response: `201 Created`
```json
{
  "id": "7b79a836-1e64-4e20-94d0-2580ecad1f78",
  "tenantId": "c4d32095-75e1-4545-931c-3b7bc45db594",
  "companyId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "code": "HQ-TOKYO",
  "name": "Tokyo Headquarters",
  "description": "Main primary global office",
  "countryCode": "JP",
  "timezone": "Asia/Tokyo",
  "address": {
    "street": "1-1 Chiyoda",
    "city": "Tokyo",
    "postalCode": "100-0001"
  },
  "isHeadquarter": true,
  "status": "scheduled",
  "effectiveAt": "2026-08-17T00:00:00.000Z",
  "createdAt": "2026-08-16T10:00:00.000Z",
  "updatedAt": "2026-08-16T10:00:00.000Z"
}
```

---

### 1.2 Update Location (Schedule Pending Change)
- **Endpoint**: `PATCH /api/v1/locations/:id`
- **Permissions**: `@Permissions('location:update')`

#### Request Body
```json
{
  "name": "Tokyo Innovation Center",
  "description": "Updated facility name",
  "effectiveAt": "2026-08-18T00:00:00.000Z"
}
```

#### Response: `200 OK` (Returns Pending Effective Change Record)
```json
{
  "id": "e0b9d997-7e61-4fa1-8255-a0ce5beeb235",
  "entityType": "location",
  "entityId": "7b79a836-1e64-4e20-94d0-2580ecad1f78",
  "operation": "UPDATE",
  "effectiveAt": "2026-08-18T00:00:00.000Z",
  "status": "scheduled",
  "payload": {
    "name": "Tokyo Innovation Center",
    "description": "Updated facility name"
  },
  "createdAt": "2026-08-16T10:05:00.000Z"
}
```

---

### 1.3 Deactivate Location (Schedule Pending Deactivation)
- **Endpoint**: `POST /api/v1/locations/:id/deactivate`
- **Permissions**: `@Permissions('location:deactivate')`

#### Request Body
```json
{
  "effectiveAt": "2026-08-20T00:00:00.000Z"
}
```

#### Response: `200 OK`
```json
{
  "id": "f2c3d4e5-a6b7-4c8d-9e0f-1a2b3c4d5e6f",
  "entityType": "location",
  "entityId": "7b79a836-1e64-4e20-94d0-2580ecad1f78",
  "operation": "DEACTIVATE",
  "effectiveAt": "2026-08-20T00:00:00.000Z",
  "status": "scheduled",
  "payload": {},
  "createdAt": "2026-08-16T10:10:00.000Z"
}
```

---

### 1.4 List Active Locations
- **Endpoint**: `GET /api/v1/locations`
- **Permissions**: `@Permissions('location:read')`
- **Query Parameters**: `page` (default 1), `limit` (default 20), `search` (optional)

#### Response: `200 OK`
```json
{
  "data": [
    {
      "id": "7b79a836-1e64-4e20-94d0-2580ecad1f78",
      "code": "HQ-TOKYO",
      "name": "Tokyo Headquarters",
      "countryCode": "JP",
      "timezone": "Asia/Tokyo",
      "isHeadquarter": true,
      "status": "active",
      "effectiveAt": "2026-08-15T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 1.5 Get Single Location Detail
- **Endpoint**: `GET /api/v1/locations/:id`
- **Permissions**: `@Permissions('location:read')`

#### Response: `200 OK`
```json
{
  "id": "7b79a836-1e64-4e20-94d0-2580ecad1f78",
  "tenantId": "c4d32095-75e1-4545-931c-3b7bc45db594",
  "companyId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "code": "HQ-TOKYO",
  "name": "Tokyo Headquarters",
  "description": "Main primary global office",
  "countryCode": "JP",
  "timezone": "Asia/Tokyo",
  "address": {
    "street": "1-1 Chiyoda",
    "city": "Tokyo",
    "postalCode": "100-0001"
  },
  "isHeadquarter": true,
  "status": "active",
  "effectiveAt": "2026-08-15T00:00:00.000Z",
  "createdAt": "2026-08-14T00:00:00.000Z",
  "updatedAt": "2026-08-15T00:00:00.000Z"
}
```

---

## 2. Kafka Event Contracts

### 2.1 Scheduled Outbox Event (Published to Go Worker)
- **Topic**: `setting.effective-change.scheduled`
- **Partition Key**: `{tenantId}:{companyId}`

```json
{
  "eventId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "eventType": "setting.effective-change.scheduled",
  "timestamp": "2026-08-16T10:00:00.000Z",
  "payload": {
    "changeId": "7b79a836-1e64-4e20-94d0-2580ecad1f78",
    "tenantId": "c4d32095-75e1-4545-931c-3b7bc45db594",
    "companyId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "entityType": "location",
    "operation": "CREATE",
    "effectiveAt": "2026-08-17T00:00:00.000Z"
  }
}
```

---

### 2.2 Execution Command Event (Consumed from Go Worker)
- **Topic**: `setting.effective-change.execute`
- **Partition Key**: `{tenantId}:{companyId}`

```json
{
  "eventId": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
  "eventType": "setting.effective-change.execute",
  "timestamp": "2026-08-17T00:00:00.000Z",
  "payload": {
    "changeId": "7b79a836-1e64-4e20-94d0-2580ecad1f78",
    "tenantId": "c4d32095-75e1-4545-931c-3b7bc45db594",
    "companyId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "entityType": "location",
    "operation": "CREATE"
  }
}
```

---

### 2.3 Master Data Domain Events (Published to Downstream Domains)
- **Topic**: `setting.master-data.events`
- **Partition Key**: `{tenantId}:{companyId}`
- **Event Types**: `setting.location.created`, `setting.location.updated`, `setting.location.deactivated`

```json
{
  "eventId": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
  "eventType": "setting.location.created",
  "timestamp": "2026-08-17T00:00:01.000Z",
  "payload": {
    "locationId": "7b79a836-1e64-4e20-94d0-2580ecad1f78",
    "tenantId": "c4d32095-75e1-4545-931c-3b7bc45db594",
    "companyId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "code": "HQ-TOKYO",
    "name": "Tokyo Headquarters",
    "countryCode": "JP",
    "timezone": "Asia/Tokyo",
    "isHeadquarter": true,
    "status": "active",
    "effectiveAt": "2026-08-17T00:00:00.000Z"
  }
}
```
