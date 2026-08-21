import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyModule } from '../company/company.module';
import { EffectiveChangeModule } from '../effective-change/effective-change.module';
import { DepartmentController } from './controllers/department.controller';
import { Department } from '@new-hros/libs-sql';
import { DepartmentRepository } from './repositories/department.repository';
import { DepartmentService } from './services/department.service';

@Module({
  imports: [TypeOrmModule.forFeature([Department]), CompanyModule, EffectiveChangeModule],
  controllers: [DepartmentController],
  providers: [DepartmentRepository, DepartmentService],
  exports: [DepartmentRepository],
})
export class DepartmentModule {}
