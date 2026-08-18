import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CompanyScopeGuard, TenantScopeGuard } from '../src/common/guards';
import { CrossCompanyReferenceException } from '../src/common/exceptions';

describe('Multi-Company Isolation & Security Specification [US1 - US4]', () => {
  describe('Company Scope Guarding & Boundary Protection [US3]', () => {
    let companyScopeGuard: CompanyScopeGuard;
    let tenantScopeGuard: TenantScopeGuard;

    beforeEach(() => {
      companyScopeGuard = new CompanyScopeGuard();
      tenantScopeGuard = new TenantScopeGuard();
    });

    const buildContext = (request: unknown): ExecutionContext =>
      ({
        switchToHttp: () => ({
          getRequest: (): unknown => request,
        }),
      }) as unknown as ExecutionContext;

    it('should reject access when user company does not match URL path company parameter', () => {
      const req = {
        params: { companyId: 'company-b-id' },
        user: { companyId: 'company-a-id', roles: ['ADMIN'] },
      };

      expect(() => companyScopeGuard.canActivate(buildContext(req))).toThrow(ForbiddenException);
    });

    it('should permit access when user company matches URL path company parameter', () => {
      const req = {
        params: { companyId: 'company-a-id' },
        user: { companyId: 'company-a-id', roles: ['ADMIN'] },
      };

      expect(companyScopeGuard.canActivate(buildContext(req))).toBe(true);
    });

    it('should permit SUPER_ADMIN access across multiple companies', () => {
      const req = {
        params: { companyId: 'company-b-id' },
        user: { companyId: 'company-a-id', roles: ['SUPER_ADMIN'] },
      };

      expect(companyScopeGuard.canActivate(buildContext(req))).toBe(true);
    });

    it('should reject access when tenant scope mismatch occurs', () => {
      const req = {
        params: { tenantId: 'tenant-2' },
        user: { tenantCode: 'tenant-1' },
      };

      expect(() => tenantScopeGuard.canActivate(buildContext(req))).toThrow(ForbiddenException);
    });
  });

  describe('Cross-Company Domain Invariant Exceptions [US2]', () => {
    it('should create CrossCompanyReferenceException with code CROSS_COMPANY_REFERENCE_PROHIBITED and status 400', () => {
      const exception = new CrossCompanyReferenceException(
        'Referenced Grade belongs to sibling company',
      );
      expect(exception.getStatus()).toBe(400);
      const response = exception.getResponse() as Record<string, unknown>;
      expect(response.code).toBe('CROSS_COMPANY_REFERENCE_PROHIBITED');
      expect(response.message).toBe('Referenced Grade belongs to sibling company');
    });
  });
});
