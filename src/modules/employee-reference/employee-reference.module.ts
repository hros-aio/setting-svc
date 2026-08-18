import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeReferenceEntity } from './entities/employee-reference.entity';
import { EmployeeReferenceRepository } from './repositories/employee-reference.repository';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeReferenceEntity])],
  providers: [EmployeeReferenceRepository],
  exports: [EmployeeReferenceRepository],
})
export class EmployeeReferenceModule {}
