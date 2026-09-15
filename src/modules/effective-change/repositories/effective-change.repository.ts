import { Injectable } from '@nestjs/common';
import { BaseRepository, TransactionService } from '@new-hros/libs-sql';
import { EffectiveChangeStatus } from '../../../enums';
import { EffectiveChangeEntity } from '../entities/effective-change.entity';

@Injectable()
export class EffectiveChangeRepository extends BaseRepository<EffectiveChangeEntity> {
  constructor(transactionService: TransactionService) {
    super(EffectiveChangeEntity, transactionService);
  }

  async findPendingChange(
    companyId: string,
    entityType: string,
    entityId: string,
  ): Promise<EffectiveChangeEntity | null> {
    return this.findOne({
      companyId,
      entityType,
      entityId,
      status: EffectiveChangeStatus.SCHEDULED,
    });
  }
}
