import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyModule } from '../company/company.module';
import { EffectiveChangeModule } from '../effective-change/effective-change.module';
import { GradeController } from './controllers/grade.controller';
import { GradeEntity } from './entities/grade.entity';
import { GradeRepository } from './repositories/grade.repository';
import { GradeQueryService } from './services/grade-query.service';
import { GradeService } from './services/grade.service';

@Module({
  imports: [TypeOrmModule.forFeature([GradeEntity]), CompanyModule, EffectiveChangeModule],
  controllers: [GradeController],
  providers: [GradeRepository, GradeService, GradeQueryService],
  exports: [GradeRepository],
})
export class GradeModule {}
