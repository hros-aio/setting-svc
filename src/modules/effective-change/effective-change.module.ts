import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department, Grade, JobTitle, Location } from '@new-hros/libs-sql';
import { EmployeeTransferEntity } from '../employee-transfer/entities/employee-transfer.entity';
import { OutboxEventsModule } from '../outbox-events';
import { PocEntity } from '../poc/entities/poc.entity';
import { EffectiveChangeConsumer } from './consumers/effective-change.consumer';
import { EffectiveChangeEntity } from './entities/effective-change.entity';
import { DepartmentApplyHandler } from './handlers/department-apply.handler';
import { EmployeeTransferApplyHandler } from './handlers/employee-transfer-apply.handler';
import { GradeApplyHandler } from './handlers/grade-apply.handler';
import { JobTitleApplyHandler } from './handlers/job-title-apply.handler';
import { LocationApplyHandler } from './handlers/location-apply.handler';
import { PocApplyHandler } from './handlers/poc-apply.handler';
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
    ]),
    OutboxEventsModule,
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
