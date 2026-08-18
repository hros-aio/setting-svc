import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';

@Injectable()
export class CompanyScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Only enforce company matching if this is a company-scoped path
    const isCompanyPath =
      request.params?.companyId !== undefined ||
      request.url?.includes('/companies/') ||
      request.route?.path?.includes('/companies/');

    if (isCompanyPath && request.params?.companyId) {
      const targetCompanyId = request.params.companyId;
      const userCompanyId = user?.companyId || RequestContextService.current()?.companyId;
      const authorizedCompanies: string[] =
        user?.companies || (userCompanyId ? [userCompanyId] : []);

      // If user has restricted company assignment, verify targetCompanyId is allowed
      if (
        userCompanyId &&
        targetCompanyId !== userCompanyId &&
        authorizedCompanies.length > 0 &&
        !authorizedCompanies.includes(targetCompanyId) &&
        !user?.roles?.includes('SUPER_ADMIN')
      ) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          message: `Access denied: Principal is not authorized to perform operations in company ${targetCompanyId}`,
          code: 'COMPANY_SCOPE_FORBIDDEN',
        });
      }
    }

    return true;
  }
}
