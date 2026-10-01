import { Injectable } from '@nestjs/common';
import { OutboxEventEntity, OutboxStatus, TransactionService } from '@new-hros/libs-sql';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class OutboxEventRepository {
  constructor(private readonly transactionService: TransactionService) {}

  protected get repository(): Repository<OutboxEventEntity> {
    return this.transactionService.getManager().getRepository(OutboxEventEntity);
  }

  async create(entityData: DeepPartial<OutboxEventEntity>): Promise<OutboxEventEntity> {
    const entity = this.repository.create(entityData);
    return this.repository.save(entity);
  }

  async find(where: FindOptionsWhere<OutboxEventEntity>): Promise<OutboxEventEntity[]> {
    return this.repository.find({ where });
  }

  async findPendingEvents(): Promise<OutboxEventEntity[]> {
    return this.find({ status: OutboxStatus.PENDING });
  }

  async clear(): Promise<void> {
    await this.repository.clear();
  }
}
