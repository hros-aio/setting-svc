import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '@new-hros/libs-sql';
import { TenantModule } from '../tenant/tenant.module';
import { CompanyController } from './controllers/company.controller';
import { CompanySetupStepEntity } from './entities/company-setup-step.entity';
import { CompanyEntity } from './entities/company.entity';
import { CompanySetupStepRepository } from './repositories/company-setup-step.repository';
import { CompanyRepository } from './repositories/company.repository';
import { CompanyProvisioningService } from './services/company-provisioning.service';
import { CompanySetupCommandService } from './services/company-setup-command.service';
import { CompanySetupQueryService } from './services/company-setup-query.service';
import { CompanyService } from './services/company.service';
import { SetupStepSeederService } from './services/setup-step-seeder.service';
import { TemplateCopyService } from './services/template-copy.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Company, CompanyEntity, CompanySetupStepEntity]),
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
