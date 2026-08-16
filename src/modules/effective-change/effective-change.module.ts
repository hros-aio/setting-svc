import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SqlModule } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from './entities/effective-change.entity';
import { LocationEntity } from '../location/entities/location.entity';
import { DepartmentEntity } from '../department/entities/department.entity';
import { OutboxEventEntity } from '../company/entities/outbox-event.entity';
import { EffectiveChangeRepository } from './repositories/effective-change.repository';
import { LocationApplyHandler } from './handlers/location-apply.handler';
import { DepartmentApplyHandler } from './handlers/department-apply.handler';
import { EffectiveChangeService } from './services/effective-change.service';
import { EffectiveChangeConsumer } from './consumers/effective-change.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EffectiveChangeEntity,
      LocationEntity,
      DepartmentEntity,
      OutboxEventEntity,
    ]),
    SqlModule,
  ],
  controllers: [EffectiveChangeConsumer],
  providers: [
    EffectiveChangeRepository,
    LocationApplyHandler,
    DepartmentApplyHandler,
    EffectiveChangeService,
  ],
  exports: [
    EffectiveChangeRepository,
    LocationApplyHandler,
    DepartmentApplyHandler,
    EffectiveChangeService,
    EffectiveChangeConsumer,
  ],
})
export class EffectiveChangeModule {}
