import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEventEntity } from '../company/entities/outbox-event.entity';
import { Department } from '@new-hros/libs-sql';
import { Grade } from '@new-hros/libs-sql';
import { JobTitle } from '@new-hros/libs-sql';
import { Location } from '@new-hros/libs-sql';
import { PocEntity } from '../poc/entities/poc.entity';
import { EmployeeTransferEntity } from '../employee-transfer/entities/employee-transfer.entity';
import { EffectiveChangeConsumer } from './consumers/effective-change.consumer';
import { EffectiveChangeEntity } from './entities/effective-change.entity';
import { DepartmentApplyHandler } from './handlers/department-apply.handler';
import { GradeApplyHandler } from './handlers/grade-apply.handler';
import { JobTitleApplyHandler } from './handlers/job-title-apply.handler';
import { LocationApplyHandler } from './handlers/location-apply.handler';
import { PocApplyHandler } from './handlers/poc-apply.handler';
import { EmployeeTransferApplyHandler } from './handlers/employee-transfer-apply.handler';
import { EffectiveChangeRepository } from './repositories/effective-change.repository';
import { EffectiveChangeService } from './services/effective-change.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EffectiveChangeEntity,
      Location,
      Department,
      Grade,
      JobTitle,
      PocEntity,
      EmployeeTransferEntity,
      OutboxEventEntity,
    ]),
  ],
  controllers: [EffectiveChangeConsumer],
  providers: [
    EffectiveChangeRepository,
    LocationApplyHandler,
    DepartmentApplyHandler,
    GradeApplyHandler,
    JobTitleApplyHandler,
    PocApplyHandler,
    EmployeeTransferApplyHandler,
    EffectiveChangeService,
  ],
  exports: [EffectiveChangeRepository],
})
export class EffectiveChangeModule {}
