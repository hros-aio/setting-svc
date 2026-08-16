export enum KafkaTopic {
  TENANT_LIFECYCLE_EVENTS = 'tenant.lifecycle-events',
  SETTING_EVENTS = 'setting.events',
  SETTING_COMPANY_EVENTS = 'setting.company.events',
  AUTHORIZATION_ROLE_COPY_REQUESTED = 'authorization.role-copy.requested',
  AUTHORIZATION_ROLE_COPY_COMPLETED = 'authorization.role-copy.completed',
  EMPLOYEE_IMPORT_BATCH_COMPLETED = 'employee-import.batch.completed',
  SETTING_EFFECTIVE_CHANGE_SCHEDULED = 'setting.effective-change.scheduled',
  SETTING_EFFECTIVE_CHANGE_EXECUTE = 'setting.effective-change.execute',
}
