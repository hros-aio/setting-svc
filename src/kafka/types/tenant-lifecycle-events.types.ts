import { TenantLifecycleEventType } from '../../enums';

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

export { TenantLifecycleEventType };
