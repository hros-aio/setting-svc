import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SqlModule } from '@new-hros/libs-sql';
import { CompanyModule } from '../company/company.module';
import { DepartmentModule } from '../department/department.module';
import { EffectiveChangeModule } from '../effective-change/effective-change.module';
import { GradeModule } from '../grade/grade.module';
import { JobTitleController } from './controllers/job-title.controller';
import { JobTitleEntity } from './entities/job-title.entity';
import { JobTitleRepository } from './repositories/job-title.repository';
import { JobTitleQueryService } from './services/job-title-query.service';
import { JobTitleService } from './services/job-title.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobTitleEntity]),
    SqlModule,
    CompanyModule,
    DepartmentModule,
    GradeModule,
    EffectiveChangeModule,
  ],
  controllers: [JobTitleController],
  providers: [JobTitleRepository, JobTitleService, JobTitleQueryService],
  exports: [JobTitleRepository],
})
export class JobTitleModule {}
