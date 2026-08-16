import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SetupStepStatus, SetupStepType } from '../../../enums';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';

export interface MarkStepCompletedParams {
  tenantId: string;
  companyId: string;
  stepType: SetupStepType;
  completedBy?: string;
  metadata?: Record<string, unknown>;
  externalReferenceId?: string;
  entityManager?: EntityManager;
}

@Injectable()
export class CompanySetupStepRepository extends Repository<CompanySetupStepEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(CompanySetupStepEntity, dataSource.createEntityManager());
  }

  async bulkCreateAndSave(
    steps: Partial<CompanySetupStepEntity>[],
    entityManager?: EntityManager,
  ): Promise<CompanySetupStepEntity[]> {
    const repo = entityManager ? entityManager.getRepository(CompanySetupStepEntity) : this;
    const entities = repo.create(steps);
    return repo.save(entities);
  }

  async findByCompanyAndStep(
    companyId: string,
    stepType: SetupStepType,
    entityManager?: EntityManager,
  ): Promise<CompanySetupStepEntity | null> {
    const repo = entityManager ? entityManager.getRepository(CompanySetupStepEntity) : this;
    return repo.findOne({ where: { companyId, stepType } });
  }

  async findStepsByCompanyId(
    companyId: string,
    entityManager?: EntityManager,
  ): Promise<CompanySetupStepEntity[]> {
    const repo = entityManager ? entityManager.getRepository(CompanySetupStepEntity) : this;
    return repo.find({
      where: { companyId },
      order: { stepOrder: 'ASC' },
    });
  }

  async markStepCompleted({
    tenantId,
    companyId,
    stepType,
    completedBy,
    metadata,
    externalReferenceId,
    entityManager,
  }: MarkStepCompletedParams): Promise<CompanySetupStepEntity | null> {
    const repo = entityManager ? entityManager.getRepository(CompanySetupStepEntity) : this;
    const step = await repo.findOne({
      where: { tenantId, companyId, stepType },
    });

    if (!step) {
      return null;
    }

    if (step.status !== SetupStepStatus.COMPLETED) {
      step.status = SetupStepStatus.COMPLETED;
      step.completedAt = new Date();
      step.completedBy = completedBy;
      if (externalReferenceId !== undefined) {
        step.externalReferenceId = externalReferenceId;
      }
      if (metadata !== undefined) {
        step.metadata = { ...(step.metadata || {}), ...metadata };
      }
      return repo.save(step);
    } else {
      // Idempotent update for metadata or external reference if supplied
      let needsSave = false;
      if (externalReferenceId !== undefined && step.externalReferenceId !== externalReferenceId) {
        step.externalReferenceId = externalReferenceId;
        needsSave = true;
      }
      if (metadata !== undefined) {
        step.metadata = { ...(step.metadata || {}), ...metadata };
        needsSave = true;
      }
      if (needsSave) {
        return repo.save(step);
      }
    }
    return step;
  }
}
