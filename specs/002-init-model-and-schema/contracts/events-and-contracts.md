# Service Interface & Domain Event Contracts: HRMS Setting Service

## 1. Domain Event Contracts (Outbox Messages)

Setting Service produces domain events when configuration master data changes. Events follow standard CloudEvents envelope structures published to Kafka via the Transactional Outbox pattern.

### Event Envelope Specification
```json
{
  "id": "uuid-v7-event-id",
  "source": "hrms.setting-service",
  "specversion": "1.0",
  "type": "com.hrms.setting.<domain>.<action>",
  "time": "2026-08-09T19:00:00Z",
  "datacontenttype": "application/json",
  "data": {
    "tenantId": "uuid-tenant-id",
    "companyId": "uuid-company-id",
    "entityId": "uuid-entity-id",
    "code": "ENTITY_CODE",
    "status": "active",
    "effectiveAt": "2026-08-09T19:00:00Z",
    "payload": {}
  }
}
```

### Event Catalog

| Event Name | Topic | Business Trigger | Key Payload Fields |
| :--- | :--- | :--- | :--- |
| `com.hrms.setting.company.created` | `hrms.setting.company-events` | Company created | `tenantId`, `companyId`, `companyCode`, `legalName`, `status` |
| `com.hrms.setting.company.activated` | `hrms.setting.company-events` | Company activated | `tenantId`, `companyId`, `companyCode`, `activatedAt` |
| `com.hrms.setting.location.created` | `hrms.setting.location-events` | Location created | `tenantId`, `companyId`, `locationId`, `code`, `isHeadquarter`, `status`, `effectiveAt` |
| `com.hrms.setting.location.updated` | `hrms.setting.location-events` | Location updated | `tenantId`, `companyId`, `locationId`, `code`, `status`, `effectiveAt` |
| `com.hrms.setting.location.deactivated`| `hrms.setting.location-events` | Location deactivated | `tenantId`, `companyId`, `locationId`, `code`, `status` |
| `com.hrms.setting.department.created` | `hrms.setting.department-events` | Department created | `tenantId`, `companyId`, `departmentId`, `code`, `parentDepartmentId`, `status`, `effectiveAt` |
| `com.hrms.setting.department.updated` | `hrms.setting.department-events` | Department updated | `tenantId`, `companyId`, `departmentId`, `code`, `parentDepartmentId`, `status`, `effectiveAt` |
| `com.hrms.setting.department.deactivated`| `hrms.setting.department-events`| Department deactivated | `tenantId`, `companyId`, `departmentId`, `code`, `status` |
| `com.hrms.setting.grade.created` | `hrms.setting.grade-events` | Grade created | `tenantId`, `companyId`, `gradeId`, `code`, `rankOrder`, `status`, `effectiveAt` |
| `com.hrms.setting.grade.updated` | `hrms.setting.grade-events` | Grade updated | `tenantId`, `companyId`, `gradeId`, `code`, `rankOrder`, `status`, `effectiveAt` |
| `com.hrms.setting.job-title.created` | `hrms.setting.job-title-events` | Job Title created | `tenantId`, `companyId`, `jobTitleId`, `code`, `departmentId`, `gradeId`, `status`, `effectiveAt` |
| `com.hrms.setting.job-title.updated` | `hrms.setting.job-title-events` | Job Title updated | `tenantId`, `companyId`, `jobTitleId`, `code`, `departmentId`, `gradeId`, `status`, `effectiveAt` |
| `com.hrms.setting.poc.assigned` | `hrms.setting.poc-events` | PoC assigned | `tenantId`, `companyId`, `pocId`, `pocType`, `employeeId`, `status`, `effectiveAt` |

---

## 2. Inbound Reference Projection Contracts

Setting Service consumes reference projections asynchronously from external services:

### Tenant Projection Consumer
- **Source Service**: Tenant / Admin Service
- **Topic**: `hrms.tenant.lifecycle-events`
- **Target Table**: `tenants`

### Employee Reference Projection Consumer
- **Source Service**: Directory Service
- **Topic**: `hrms.directory.employee-events`
- **Target Table**: `employee_references`
