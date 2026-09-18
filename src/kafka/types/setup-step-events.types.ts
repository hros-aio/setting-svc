export interface RoleCopyCompletedPayload {
  batchId: string;
  tenantCode: string;
  sourceCompanyId: string;
  targetCompanyId: string;
  copiedRoleCount?: number;
}

export interface EmployeeImportCompletedPayload {
  batchId: string;
  tenantCode: string;
  companyId: string;
  importedCount?: number;
  metadata?: Record<string, unknown>;
}
