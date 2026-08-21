export { CompanyStatus, MasterDataStatus } from '@new-hros/libs-sql';

export enum SetupStepType {
  COMPANY_INFORMATION = 'company_information',
  LOCATION = 'location',
  DEPARTMENT = 'department',
  GRADE = 'grade',
  JOB_TITLE = 'job_title',
  ROLE = 'role',
  EMPLOYEE_IMPORT = 'employee_import',
  POC = 'poc',
}

export enum SetupStepStatus {
  INCOMPLETE = 'incomplete',
  COMPLETED = 'completed',
}

export enum ChangeOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DEACTIVATE = 'deactivate',
}

export enum EffectiveChangeStatus {
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  APPLIED = 'applied',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  CONFLICT = 'conflict',
}
