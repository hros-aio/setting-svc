import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { SetupStepStatus, SetupStepType } from '../../../enums';

@Injectable()
export class CompanySetupStepRepository extends Repository<CompanySetupStepEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(CompanySetupStepEntity, dataSource.createEntityManager());
  }

  async bulkCreateAndSave(
    steps: Partial<CompanySetupStepEntity>[],
    manager?: EntityManager,
  ): Promise<CompanySetupStepEntity[]> {
    const repo = manager ? manager.getRepository(CompanySetupStepEntity) : this;
    const entities = repo.create(steps);
    return repo.save(entities);
  }

  async findByCompanyAndStep(
    companyId: string,
    stepType: SetupStepType,
    manager?: EntityManager,
  ): Promise<CompanySetupStepEntity | null> {
    const repo = manager ? manager.getRepository(CompanySetupStepEntity) : this;
    return repo.findOne({ where: { companyId, stepType } });
  }

  async findStepsByCompanyId(
    companyId: string,
    manager?: EntityManager,
  ): Promise<CompanySetupStepEntity[]> {
    const repo = manager ? manager.getRepository(CompanySetupStepEntity) : this;
    return repo.find({
      where: { companyId },
      order: { stepOrder: 'ASC' },
    });
  }

  async markStepCompleted(
    tenantId: string,
    companyId: string,
    stepType: SetupStepType,
    completedBy?: string,
    manager?: EntityManager,
  ): Promise<CompanySetupStepEntity | null> {
    const repo = manager ? manager.getRepository(CompanySetupStepEntity) : this;
    const step = await repo.findOne({ where: { tenantId, companyId, stepType } });
    if (!step) {
      return null;
    }
    if (step.status !== SetupStepStatus.COMPLETED) {
      step.status = SetupStepStatus.COMPLETED;
      step.completedAt = new Date();
      step.completedBy = completedBy;
      return repo.save(step);
    }
    return step;
  }
}
