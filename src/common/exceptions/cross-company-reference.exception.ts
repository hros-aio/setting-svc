import { BadRequestException } from '@nestjs/common';

export class CrossCompanyReferenceException extends BadRequestException {
  constructor(message?: string) {
    super({
      statusCode: 400,
      error: 'Bad Request',
      message: message || 'Cross-company entity reference is strictly prohibited',
      code: 'CROSS_COMPANY_REFERENCE_PROHIBITED',
    });
  }
}
