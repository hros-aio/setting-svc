import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';

@Injectable()
export class TenantScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const contextTenantCode =
      user?.tenantCode || user?.tenantId || RequestContextService.getTenantCode();

    const paramTenantId = request.params?.tenantId || request.headers?.['x-tenant-id'];

    if (paramTenantId && contextTenantCode && paramTenantId !== contextTenantCode) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: `Access denied: Principal tenant '${contextTenantCode}' does not match requested tenant '${paramTenantId}'`,
        code: 'TENANT_SCOPE_FORBIDDEN',
      });
    }

    return true;
  }
}
