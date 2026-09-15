import { CrossCompanyReferenceException } from '@new-hros/libs-apis';

describe('Multi-Company Isolation & Security Specification [US1 - US4]', () => {
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
