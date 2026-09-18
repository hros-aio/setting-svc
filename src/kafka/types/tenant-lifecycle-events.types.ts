import { TenantLifecycleEventType } from '../../enums';

export interface TenantCreatedPayload {
  id: string;
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
