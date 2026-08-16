import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SqlModule } from '@new-hros/libs-sql';
import { GradeEntity } from './entities/grade.entity';
import { GradeRepository } from './repositories/grade.repository';
import { GradeService } from './services/grade.service';
import { GradeQueryService } from './services/grade-query.service';
import { GradeController } from './controllers/grade.controller';
import { CompanyModule } from '../company/company.module';
import { EffectiveChangeEntity } from '../effective-change/entities/effective-change.entity';
import { OutboxEventEntity } from '../company/entities/outbox-event.entity';
import { EffectiveChangeModule } from '../effective-change/effective-change.module';
import { EffectiveChangeRepository } from '../effective-change/repositories/effective-change.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([GradeEntity, EffectiveChangeEntity, OutboxEventEntity]),
    SqlModule,
    CompanyModule,
    EffectiveChangeModule,
  ],
  controllers: [GradeController],
  providers: [GradeRepository, EffectiveChangeRepository, GradeService, GradeQueryService],
  exports: [GradeRepository, GradeService, GradeQueryService],
})
export class GradeModule {}
