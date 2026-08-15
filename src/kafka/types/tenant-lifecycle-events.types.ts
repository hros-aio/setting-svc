export interface TenantCreatedPayload {
  tenantId: string;
  tenantCode: string;
  name: string;
  legalName?: string;
  displayName?: string;
  countryCode?: string;
  currencyCode?: string;
  timezone?: string;
  sourceVersion?: number | string;
}

export enum TenantLifecycleEventType {
  TENANT_CREATED = 'tenant.created',
  TENANT_PROVISIONED = 'tenant.provisioned',
}
