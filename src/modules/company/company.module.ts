import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from './entities/company.entity';
import { CompanySetupStepEntity } from './entities/company-setup-step.entity';
import { OutboxEventEntity } from './entities/outbox-event.entity';
import { CompanyRepository } from './repositories/company.repository';
import { CompanySetupStepRepository } from './repositories/company-setup-step.repository';
import { SetupStepSeederService } from './services/setup-step-seeder.service';
import { CompanyProvisioningService } from './services/company-provisioning.service';
import { CompanyService } from './services/company.service';
import { TemplateCopyService } from './services/template-copy.service';
import { CompanySetupQueryService } from './services/company-setup-query.service';
import { CompanySetupCommandService } from './services/company-setup-command.service';
import { CompanyController } from './controllers/company.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyEntity, CompanySetupStepEntity, OutboxEventEntity]),
    TenantModule,
  ],
  controllers: [CompanyController],
  providers: [
    CompanyRepository,
    CompanySetupStepRepository,
    SetupStepSeederService,
    TemplateCopyService,
    CompanyService,
    CompanyProvisioningService,
    CompanySetupQueryService,
    CompanySetupCommandService,
  ],
  exports: [
    CompanyRepository,
    CompanySetupStepRepository,
    SetupStepSeederService,
    TemplateCopyService,
    CompanyService,
    CompanyProvisioningService,
    CompanySetupQueryService,
    CompanySetupCommandService,
  ],
})
export class CompanyModule {}
