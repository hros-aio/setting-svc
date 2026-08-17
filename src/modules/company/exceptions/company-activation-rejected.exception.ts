import { HttpException, HttpStatus } from '@nestjs/common';
import { SetupStepType } from '../../../enums';

export class CompanyActivationRejectedException extends HttpException {
  public readonly incompleteSteps: SetupStepType[];

  constructor(
    incompleteSteps: SetupStepType[],
    message = 'Company activation rejected: mandatory setup steps are incomplete.',
  ) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'Unprocessable Entity',
        message,
        incompleteSteps,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
    this.incompleteSteps = incompleteSteps;
  }
}
