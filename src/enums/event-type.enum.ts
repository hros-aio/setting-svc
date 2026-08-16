export enum TenantLifecycleEventType {
  TENANT_CREATED = 'tenant.created',
  TENANT_PROVISIONED = 'tenant.provisioned',
}

export enum CompanyEventType {
  COMPANY_CREATED = 'company.created',
  COMPANY_UPDATED = 'company.updated',
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

export enum EventType {
  TENANT_CREATED = 'tenant.created',
  TENANT_PROVISIONED = 'tenant.provisioned',
  COMPANY_CREATED = 'company.created',
  COMPANY_UPDATED = 'company.updated',
  COMPANY_DEACTIVATED = 'company.deactivated',
  ROLE_COPY_REQUESTED = 'authorization.role-copy.requested',
  ROLE_COPY_COMPLETED = 'authorization.role-copy.completed',
  EFFECTIVE_CHANGE_SCHEDULED = 'setting.effective-change.scheduled',
  EFFECTIVE_CHANGE_EXECUTE = 'setting.effective-change.execute',
  LOCATION_CREATED = 'setting.location.created',
  LOCATION_UPDATED = 'setting.location.updated',
  LOCATION_DEACTIVATED = 'setting.location.deactivated',
}
