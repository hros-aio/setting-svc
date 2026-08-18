# Interface & Event Contracts: Multi-Company Isolation

**Feature**: Multi-Company Isolation  
**Date**: 2026-08-18  
**Status**: Completed  

---

## 1. REST API Security & Scope Contracts

### 1.1 Scope Guarding Behavior

All company-scoped endpoints follow the URL path pattern `/companies/:companyId/*`.

```
Incoming Request: GET/POST/PATCH/DELETE /companies/:companyId/resource
   │
   ▼
[AuthGuard] (Validates RS256 JWT, sets RequestContext.tenantId, RequestContext.userId)
   │
   ▼
[PermissionGuard] (Validates required permission, e.g. location:create)
   │
   ▼
[TenantScopeGuard] (Validates RequestContext.tenantId matches resource tenant)
   │
   ▼
[CompanyScopeGuard] (Validates path.companyId matches user authorized company claims)
   │
   ▼
[Controller Handler] -> [Domain Service] -> [Scoped Repository]
```

### 1.2 Error Responses for Scope Violations

#### Mismatched Company Scope (HTTP 403 Forbidden)
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Access denied: Principal is not authorized to perform operations in company 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "code": "COMPANY_SCOPE_FORBIDDEN"
}
```

#### Cross-Company Entity Reference (HTTP 400 Bad Request)
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Relational invariant violation: Referenced Grade '201' does not belong to Company '101'",
  "code": "CROSS_COMPANY_REFERENCE_PROHIBITED"
}
```

#### Cross-Company Department Hierarchy Loop/Reference (HTTP 400 Bad Request)
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Relational invariant violation: Parent Department '301' does not belong to Company '101'",
  "code": "CROSS_COMPANY_REFERENCE_PROHIBITED"
}
```

#### Cross-Company Entity ID In Repository Lookup (HTTP 404 Not Found)
When a client requests `/companies/{companyAId}/locations/{locationInCompanyBId}`:
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Location not found in the specified company context",
  "code": "RESOURCE_NOT_FOUND"
}
```

---

## 2. Kafka Event Partitioning & Outbox Contract

All asynchronous domain events and effective-change messages published via the Transactional Outbox must enforce the composite partition key format `${tenantId}:${companyId}`.

### 2.1 Outbox Event Record Envelope
```json
{
  "id": "01912a78-9e5c-7000-8000-000000000001",
  "aggregateType": "job_title",
  "aggregateId": "01912a78-9e5c-7000-8000-000000000002",
  "eventType": "setting.effective-change.scheduled",
  "status": "pending",
  "payload": {
    "tenantId": "01912a78-9e5c-7000-8000-000000000010",
    "companyId": "01912a78-9e5c-7000-8000-000000000020",
    "changeId": "01912a78-9e5c-7000-8000-000000000030",
    "entityType": "job_title",
    "entityId": "01912a78-9e5c-7000-8000-000000000002",
    "operation": "CREATE",
    "effectiveAt": "2026-09-01T00:00:00.000Z",
    "data": {
      "code": "SR_ENG",
      "name": "Senior Software Engineer",
      "departmentId": "01912a78-9e5c-7000-8000-000000000040",
      "gradeId": "01912a78-9e5c-7000-8000-000000000050"
    }
  }
}
```

### 2.2 Kafka Message Envelope
```typescript
export interface KafkaOutboxMessage<T = unknown> {
  topic: string;
  key: string; // Formatted strictly as `${tenantId}:${companyId}`
  value: {
    specversion: '1.0';
    type: string; // e.g. 'setting.effective-change.scheduled'
    source: '/setting-service';
    id: string; // Outbox Event UUID
    time: string; // ISO 8601 UTC
    datacontenttype: 'application/json';
    data: T;
    metadata: {
      tenantId: string;
      companyId: string;
      correlationId: string;
      userId?: string;
    };
  };
  headers: {
    'x-tenant-id': string;
    'x-company-id': string;
    'x-correlation-id': string;
  };
}
```

---

## 3. Worker Execution Callback Contract

When the Go Effective-Dated Change Worker triggers execution back into the Setting Service:

- **Topic**: `setting.effective-change.execute`
- **Partition Key**: `${tenantId}:${companyId}`
- **Payload**:
```json
{
  "changeId": "01912a78-9e5c-7000-8000-000000000030",
  "tenantId": "01912a78-9e5c-7000-8000-000000000010",
  "companyId": "01912a78-9e5c-7000-8000-000000000020",
  "entityType": "job_title",
  "entityId": "01912a78-9e5c-7000-8000-000000000002",
  "operation": "create",
  "effectiveAt": "2026-09-01T00:00:00.000Z"
}
```
The Setting Service consumer validates `tenantId` and `companyId` before invoking `EffectiveChangeService.executeChange(command)`.
