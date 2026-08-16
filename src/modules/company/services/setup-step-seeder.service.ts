import { Injectable, BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { SetupStepStatus, SetupStepType } from '../../../enums';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';
import { MANDATORY_SETUP_STEPS_SEQUENCE } from '../enums/mandatory-setup-steps.enum';
import { CopyableCategory } from '../enums/copyable-category.enum';

@Injectable()
export class SetupStepSeederService {
  constructor(private readonly setupStepRepository: CompanySetupStepRepository) {}

  async seedMandatorySteps(
    tenantId: string,
    companyId: string,
    copiedCategories: CopyableCategory[] = [],
    entityManager?: EntityManager,
  ): Promise<CompanySetupStepEntity[]> {
    if (!tenantId || !companyId) {
      throw new BadRequestException('tenantId and companyId are required to seed setup steps');
    }

    const copiedSet = new Set(copiedCategories || []);

    const stepsToCreate: Partial<CompanySetupStepEntity>[] = MANDATORY_SETUP_STEPS_SEQUENCE.map(
      (step) => {
        let isCompleted = false;
        if (step.type === SetupStepType.GRADE && copiedSet.has(CopyableCategory.GRADES)) {
          isCompleted = true;
        } else if (
          step.type === SetupStepType.JOB_TITLE &&
          copiedSet.has(CopyableCategory.JOB_TITLES)
        ) {
          isCompleted = true;
        }

        return {
          tenantId,
          companyId,
          stepType: step.type,
          stepOrder: step.order,
          status: isCompleted ? SetupStepStatus.COMPLETED : SetupStepStatus.INCOMPLETE,
          completedAt: isCompleted ? new Date() : undefined,
          metadata: isCompleted ? { completedViaCopy: true } : {},
        };
      },
    );

    return this.setupStepRepository.bulkCreateAndSave(stepsToCreate, entityManager);
  }
}
