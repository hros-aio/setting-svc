import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
  Check,
} from 'typeorm';
import { TenantEntity } from '../../tenant/entities/tenant.entity';
import { CompanySetupStepEntity } from './company-setup-step.entity';
import { CompanyStatus } from '../../../common/enums/domain-enums';

@Entity('companies')
@Unique('uq_companies_tenant_code', ['tenantId', 'companyCode'])
@Check(
  'ck_companies_activation_state',
  `(status = 'pending' AND activated_at IS NULL) OR (status = 'active' AND activated_at IS NOT NULL)`,
)
export class CompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => TenantEntity, (tenant) => tenant.companies, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @Column({ type: 'varchar', length: 64, name: 'company_code' })
  companyCode: string;

  @Column({ type: 'varchar', length: 255, name: 'legal_name' })
  legalName: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'display_name' })
  displayName?: string;

  @Column({ type: 'enum', enum: CompanyStatus, default: CompanyStatus.PENDING })
  status: CompanyStatus;

  @Column({ type: 'boolean', default: false, name: 'is_template' })
  isTemplate: boolean;

  @Column({ type: 'varchar', length: 128, nullable: true, name: 'registration_number' })
  registrationNumber?: string;

  @Column({ type: 'varchar', length: 128, nullable: true, name: 'tax_registration_number' })
  taxRegistrationNumber?: string;

  @Column({ type: 'char', length: 2, nullable: true, name: 'country_code' })
  countryCode?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'legal_address' })
  legalAddress?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  locale?: string;

  @Column({ type: 'char', length: 3, nullable: true, name: 'currency_code' })
  currencyCode?: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'information_completed_at' })
  informationCompletedAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'information_completed_by' })
  informationCompletedBy?: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'activated_at' })
  activatedAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'activated_by' })
  activatedBy?: string;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy?: string;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => CompanySetupStepEntity, (step) => step.company)
  setupSteps: CompanySetupStepEntity[];
}
