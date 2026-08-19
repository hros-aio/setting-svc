export enum TenantLifecycleEventType {
  TENANT_CREATED = 'tenant.created',
  TENANT_PROVISIONED = 'tenant.provisioned',
}

export enum CompanyEventType {
  COMPANY_CREATED = 'company.created',
  COMPANY_UPDATED = 'company.updated',
  COMPANY_ACTIVATED = 'company.activated',
  COMPANY_DEACTIVATED = 'company.deactivated',
  ROLE_COPY_REQUESTED = 'authorization.role-copy.requested',
  ROLE_COPY_COMPLETED = 'authorization.role-copy.completed',
}

export enum EffectiveChangeEventType {
  EFFECTIVE_CHANGE_SCHEDULED = 'setting.effective-change.scheduled',
  EFFECTIVE_CHANGE_EXECUTE = 'setting.effective-change.execute',
}

export enum LocationEventType {
  LOCATION_CREATED = 'setting.location.created',
  LOCATION_UPDATED = 'setting.location.updated',
  LOCATION_DEACTIVATED = 'setting.location.deactivated',
}

export enum DepartmentEventType {
  DEPARTMENT_CREATED = 'setting.department.created',
  DEPARTMENT_UPDATED = 'setting.department.updated',
  DEPARTMENT_DEACTIVATED = 'setting.department.deactivated',
}

export enum GradeEventType {
  GRADE_CREATED = 'setting.grade.created',
  GRADE_UPDATED = 'setting.grade.updated',
  GRADE_DEACTIVATED = 'setting.grade.deactivated',
}

export enum JobTitleEventType {
  JOB_TITLE_CREATED = 'setting.job-title.created',
  JOB_TITLE_UPDATED = 'setting.job-title.updated',
  JOB_TITLE_DEACTIVATED = 'setting.job-title.deactivated',
}

export enum PocEventType {
  POC_ASSIGNED = 'setting.poc.assigned',
  POC_REPLACED = 'setting.poc.replaced',
  POC_DEACTIVATED = 'setting.poc.deactivated',
}

export enum EmployeeTransferEventType {
  SETTING_EMPLOYEE_TRANSFER_EVENTS = 'setting.employee-transfer.events',
  EMPLOYEE_COMPANY_TRANSFERRED = 'employee.company-transferred',
}

export enum EventType {
  TENANT_CREATED = 'tenant.created',
  TENANT_PROVISIONED = 'tenant.provisioned',
  COMPANY_CREATED = 'company.created',
  COMPANY_UPDATED = 'company.updated',
  COMPANY_ACTIVATED = 'company.activated',
  COMPANY_DEACTIVATED = 'company.deactivated',
  ROLE_COPY_REQUESTED = 'authorization.role-copy.requested',
  ROLE_COPY_COMPLETED = 'authorization.role-copy.completed',
  EFFECTIVE_CHANGE_SCHEDULED = 'setting.effective-change.scheduled',
  EFFECTIVE_CHANGE_EXECUTE = 'setting.effective-change.execute',
  LOCATION_CREATED = 'setting.location.created',
  LOCATION_UPDATED = 'setting.location.updated',
  LOCATION_DEACTIVATED = 'setting.location.deactivated',
  DEPARTMENT_CREATED = 'setting.department.created',
  DEPARTMENT_UPDATED = 'setting.department.updated',
  DEPARTMENT_DEACTIVATED = 'setting.department.deactivated',
  GRADE_CREATED = 'setting.grade.created',
  GRADE_UPDATED = 'setting.grade.updated',
  GRADE_DEACTIVATED = 'setting.grade.deactivated',
  JOB_TITLE_CREATED = 'setting.job-title.created',
  JOB_TITLE_UPDATED = 'setting.job-title.updated',
  JOB_TITLE_DEACTIVATED = 'setting.job-title.deactivated',
  POC_ASSIGNED = 'setting.poc.assigned',
  POC_REPLACED = 'setting.poc.replaced',
  POC_DEACTIVATED = 'setting.poc.deactivated',
  SETTING_EMPLOYEE_TRANSFER_EVENTS = 'setting.employee-transfer.events',
  EMPLOYEE_COMPANY_TRANSFERRED = 'employee.company-transferred',
}
