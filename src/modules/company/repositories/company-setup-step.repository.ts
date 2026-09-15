import { Injectable } from '@nestjs/common';
import { BaseRepository, TransactionService } from '@new-hros/libs-sql';
import { SetupStepStatus, SetupStepType } from '../../../enums';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';

export interface MarkStepCompletedParams {
  companyId: string;
  stepType: SetupStepType;
  completedBy?: string;
  metadata?: Record<string, unknown>;
  externalReferenceId?: string;
}

@Injectable()
export class CompanySetupStepRepository extends BaseRepository<CompanySetupStepEntity> {
  constructor(transactionService: TransactionService) {
    super(CompanySetupStepEntity, transactionService);
  }

  async bulkCreateAndSave(
    steps: Partial<CompanySetupStepEntity>[],
  ): Promise<CompanySetupStepEntity[]> {
    const entities = this.repository.create(steps);
    return this.repository.save(entities);
  }

  async findByCompanyAndStep(
    companyId: string,
    stepType: SetupStepType,
  ): Promise<CompanySetupStepEntity | null> {
    return this.findOne({ companyId, stepType });
  }

  async findByCompanyId(companyId: string): Promise<CompanySetupStepEntity[]> {
    return this.find(
      {
        companyId,
      },
      {
        order: { stepOrder: 'ASC' },
      },
    );
  }

  async markStepCompleted({
    companyId,
    stepType,
    completedBy,
    metadata,
    externalReferenceId,
  }: MarkStepCompletedParams): Promise<CompanySetupStepEntity | null> {
    const step = await this.findOne({
      companyId,
      stepType,
    });

    if (!step) {
      return null;
    }

    if (step.status !== SetupStepStatus.COMPLETED) {
      return this.update(step.id, {
        status: SetupStepStatus.COMPLETED,
        completedAt: new Date(),
        completedBy,
        externalReferenceId,
        metadata: { ...(step.metadata || {}), ...metadata },
      });
    }

    return this.update(step.id, {
      externalReferenceId,
      metadata: { ...(step.metadata || {}), ...metadata },
    });
  }
}
