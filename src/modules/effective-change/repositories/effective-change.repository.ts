import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EffectiveChangeEntity } from '../entities/effective-change.entity';
import { EffectiveChangeStatus } from '../../../enums';

@Injectable()
export class EffectiveChangeRepository extends Repository<EffectiveChangeEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(EffectiveChangeEntity, dataSource.createEntityManager());
  }

  async findPendingChange(
    companyId: string,
    entityType: string,
    entityId: string,
    manager?: EntityManager,
  ): Promise<EffectiveChangeEntity | null> {
    const repo = manager ? manager.getRepository(EffectiveChangeEntity) : this;
    return repo.findOne({
      where: {
        companyId,
        entityType,
        entityId,
        status: EffectiveChangeStatus.SCHEDULED,
      },
    });
  }

  async createAndSave(
    changeData: Partial<EffectiveChangeEntity>,
    manager?: EntityManager,
  ): Promise<EffectiveChangeEntity> {
    const repo = manager ? manager.getRepository(EffectiveChangeEntity) : this;
    const change = repo.create(changeData);
    return repo.save(change);
  }
}
