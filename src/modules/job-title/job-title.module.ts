import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SqlModule } from '@new-hros/libs-sql';
import { JobTitleEntity } from './entities/job-title.entity';
import { JobTitleRepository } from './repositories/job-title.repository';
import { JobTitleService } from './services/job-title.service';
import { JobTitleQueryService } from './services/job-title-query.service';
import { JobTitleController } from './controllers/job-title.controller';
import { CompanyModule } from '../company/company.module';
import { DepartmentModule } from '../department/department.module';
import { GradeModule } from '../grade/grade.module';
import { EffectiveChangeEntity } from '../effective-change/entities/effective-change.entity';
import { OutboxEventEntity } from '../company/entities/outbox-event.entity';
import { EffectiveChangeModule } from '../effective-change/effective-change.module';
import { EffectiveChangeRepository } from '../effective-change/repositories/effective-change.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobTitleEntity, EffectiveChangeEntity, OutboxEventEntity]),
    SqlModule,
    CompanyModule,
    DepartmentModule,
    GradeModule,
    EffectiveChangeModule,
  ],
  controllers: [JobTitleController],
  providers: [JobTitleRepository, EffectiveChangeRepository, JobTitleService, JobTitleQueryService],
  exports: [JobTitleRepository, JobTitleService, JobTitleQueryService],
})
export class JobTitleModule {}
