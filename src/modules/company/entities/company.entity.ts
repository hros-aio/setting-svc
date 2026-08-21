import { Company } from '@new-hros/libs-sql';
import { Entity, OneToMany } from 'typeorm';
import { TableName } from '../../../enums';
import { CompanySetupStepEntity } from './company-setup-step.entity';

@Entity(TableName.COMPANIES)
export class CompanyEntity extends Company {
  @OneToMany(() => CompanySetupStepEntity, (step) => step.company)
  setupSteps?: CompanySetupStepEntity[];
}
