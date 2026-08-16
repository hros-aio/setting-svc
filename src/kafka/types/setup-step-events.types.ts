export interface RoleCopyCompletedPayload {
  batchId: string;
  tenantId: string;
  sourceCompanyId: string;
  targetCompanyId: string;
  copiedRoleCount?: number;
}

export interface EmployeeImportCompletedPayload {
  batchId: string;
  tenantId: string;
  companyId: string;
  importedCount?: number;
  metadata?: Record<string, unknown>;
}
