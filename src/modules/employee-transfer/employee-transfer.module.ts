import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyModule } from '../company/company.module';
import { OutboxEventEntity } from '../company/entities/outbox-event.entity';
import { DepartmentModule } from '../department/department.module';
import { EffectiveChangeModule } from '../effective-change/effective-change.module';
import { EmployeeReferenceModule } from '../employee-reference/employee-reference.module';
import { EmployeeReferenceEntity } from '../employee-reference/entities/employee-reference.entity';
import { GradeModule } from '../grade/grade.module';
import { JobTitleModule } from '../job-title/job-title.module';
import { LocationModule } from '../location/location.module';
import { EmployeeTransferController } from './controllers/employee-transfer.controller';
import { EmployeeTransferEntity } from './entities/employee-transfer.entity';
import { EmployeeTransferRepository } from './repositories/employee-transfer.repository';
import { EmployeeTransferQueryService } from './services/employee-transfer-query.service';
import { EmployeeTransferService } from './services/employee-transfer.service';
import { ValidateTransferRequestService } from './services/validate-transfer-request.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeeTransferEntity, OutboxEventEntity, EmployeeReferenceEntity]),
    CompanyModule,
    LocationModule,
    DepartmentModule,
    GradeModule,
    JobTitleModule,
    EmployeeReferenceModule,
    EffectiveChangeModule,
  ],
  controllers: [EmployeeTransferController],
  providers: [
    EmployeeTransferRepository,
    ValidateTransferRequestService,
    EmployeeTransferService,
    EmployeeTransferQueryService,
  ],
  exports: [EmployeeTransferRepository],
})
export class EmployeeTransferModule {}
