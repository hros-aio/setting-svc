import { Injectable, BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { SetupStepStatus } from '../../../common/enums/domain-enums';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';
import { MANDATORY_SETUP_STEPS_SEQUENCE } from '../enums/mandatory-setup-steps.enum';

@Injectable()
export class SetupStepSeederService {
  constructor(private readonly setupStepRepository: CompanySetupStepRepository) {}

  async seedMandatorySteps(
    tenantId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<CompanySetupStepEntity[]> {
    if (!tenantId || !companyId) {
      throw new BadRequestException('tenantId and companyId are required to seed setup steps');
    }

    const stepsToCreate: Partial<CompanySetupStepEntity>[] = MANDATORY_SETUP_STEPS_SEQUENCE.map(
      (step) => ({
        tenantId,
        companyId,
        stepType: step.type,
        stepOrder: step.order,
        status: SetupStepStatus.INCOMPLETE,
        metadata: {},
      }),
    );

    return this.setupStepRepository.bulkCreateAndSave(stepsToCreate, manager);
  }
}
