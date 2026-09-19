import { EmployeeImportCompletedHandler } from './employee-import-completed.handler';
import { RoleCopyCompletedHandler } from './role-copy-completed.handler';
import { TenantProvisioningHandler } from './tenant-provisioning.handler';

export const Handlers = [
  EmployeeImportCompletedHandler,
  RoleCopyCompletedHandler,
  TenantProvisioningHandler,
];
