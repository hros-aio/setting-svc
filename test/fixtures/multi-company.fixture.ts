import { AuthContext } from '@new-hros/libs-core';

export const MOCK_TENANT_ID = '01912a78-9e5c-7000-8000-000000000001';
export const MOCK_COMPANY_A_ID = '01912a78-9e5c-7000-8000-000000000010';
export const MOCK_COMPANY_B_ID = '01912a78-9e5c-7000-8000-000000000020';
export const MOCK_USER_ID = '01912a78-9e5c-7000-8000-000000000099';

export function createMockAuthContext(
  options: {
    tenantId?: string;
    companyId?: string;
    userId?: string;
    roles?: string[];
    permissions?: string[];
  } = {},
): AuthContext {
  return {
    tenantId: options.tenantId || MOCK_TENANT_ID,
    companyId: options.companyId || MOCK_COMPANY_A_ID,
    userId: options.userId || MOCK_USER_ID,
    roles: options.roles || ['ADMIN'],
    permissions: options.permissions || ['*'],
  } as unknown as AuthContext;
}

export function createSiblingCompanyAuthContexts(): {
  companyAContext: AuthContext;
  companyBContext: AuthContext;
} {
  return {
    companyAContext: createMockAuthContext({ companyId: MOCK_COMPANY_A_ID }),
    companyBContext: createMockAuthContext({ companyId: MOCK_COMPANY_B_ID }),
  };
}
