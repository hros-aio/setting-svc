import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';

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
}
