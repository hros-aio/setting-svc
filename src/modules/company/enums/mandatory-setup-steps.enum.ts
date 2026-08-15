import { SetupStepType } from '../../../enums';

export interface MandatorySetupStepDefinition {
  type: SetupStepType;
  order: number;
}

export const MANDATORY_SETUP_STEPS_SEQUENCE: MandatorySetupStepDefinition[] = [
  { type: SetupStepType.COMPANY_INFORMATION, order: 1 },
  { type: SetupStepType.LOCATION, order: 2 },
  { type: SetupStepType.DEPARTMENT, order: 3 },
  { type: SetupStepType.GRADE, order: 4 },
  { type: SetupStepType.JOB_TITLE, order: 5 },
  { type: SetupStepType.ROLE, order: 6 },
  { type: SetupStepType.EMPLOYEE_IMPORT, order: 7 },
  { type: SetupStepType.POC, order: 8 },
];
