import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyModule } from '../company/company.module';
import { EffectiveChangeModule } from '../effective-change/effective-change.module';
import { EmployeeReferenceModule } from '../employee-reference/employee-reference.module';
import { PocController } from './controllers/poc.controller';
import { PocEntity } from './entities/poc.entity';
import { PocRepository } from './repositories/poc.repository';
import { PocQueryService } from './services/poc-query.service';
import { PocService } from './services/poc.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PocEntity]),
    CompanyModule,
    EffectiveChangeModule,
    EmployeeReferenceModule,
  ],
  controllers: [PocController],
  providers: [PocRepository, PocService, PocQueryService],
  exports: [PocRepository],
})
export class PocModule {}
