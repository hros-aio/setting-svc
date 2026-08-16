import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SqlModule } from '@new-hros/libs-sql';
import { DepartmentEntity } from './entities/department.entity';
import { DepartmentRepository } from './repositories/department.repository';
import { DepartmentService } from './services/department.service';
import { DepartmentController } from './controllers/department.controller';
import { CompanyModule } from '../company/company.module';
import { EffectiveChangeEntity } from '../effective-change/entities/effective-change.entity';
import { OutboxEventEntity } from '../company/entities/outbox-event.entity';
import { EffectiveChangeModule } from '../effective-change/effective-change.module';
import { EffectiveChangeRepository } from '../effective-change/repositories/effective-change.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([DepartmentEntity, EffectiveChangeEntity, OutboxEventEntity]),
    SqlModule,
    CompanyModule,
    EffectiveChangeModule,
  ],
  controllers: [DepartmentController],
  providers: [DepartmentRepository, EffectiveChangeRepository, DepartmentService],
  exports: [DepartmentRepository, DepartmentService],
})
export class DepartmentModule {}
