import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from './entities/company.entity';
import { CompanySetupStepEntity } from './entities/company-setup-step.entity';
import { OutboxEventEntity } from './entities/outbox-event.entity';
import { CompanyRepository } from './repositories/company.repository';
import { CompanySetupStepRepository } from './repositories/company-setup-step.repository';
import { SetupStepSeederService } from './services/setup-step-seeder.service';
import { CompanyProvisioningService } from './services/company-provisioning.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyEntity, CompanySetupStepEntity, OutboxEventEntity]),
    TenantModule,
  ],
  providers: [
    CompanyRepository,
    CompanySetupStepRepository,
    SetupStepSeederService,
    CompanyProvisioningService,
  ],
  exports: [
    CompanyRepository,
    CompanySetupStepRepository,
    SetupStepSeederService,
    CompanyProvisioningService,
  ],
})
export class CompanyModule {}
