import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SqlModule } from '@new-hros/libs-sql';
import { CompanyModule } from '../company/company.module';
import { EffectiveChangeModule } from '../effective-change/effective-change.module';
import { DepartmentController } from './controllers/department.controller';
import { DepartmentEntity } from './entities/department.entity';
import { DepartmentRepository } from './repositories/department.repository';
import { DepartmentService } from './services/department.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DepartmentEntity]),
    SqlModule,
    CompanyModule,
    EffectiveChangeModule,
  ],
  controllers: [DepartmentController],
  providers: [DepartmentRepository, DepartmentService],
  exports: [DepartmentRepository],
})
export class DepartmentModule {}
