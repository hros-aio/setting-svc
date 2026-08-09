import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Check,
} from 'typeorm';
import { CompanyEntity } from './company.entity';
import { TenantEntity } from '../../tenant/entities/tenant.entity';
import { SetupStepType, SetupStepStatus } from '../../../common/enums/domain-enums';

@Entity('company_setup_steps')
@Unique('uq_company_setup_step', ['companyId', 'stepType'])
@Unique('uq_company_setup_order', ['companyId', 'stepOrder'])
@Check(`ck_company_setup_order`, `step_order BETWEEN 1 AND 8`)
@Check(`ck_company_setup_completion`, `(status = 'incomplete' AND completed_at IS NULL) OR (status = 'completed' AND completed_at IS NOT NULL)`)
export class CompanySetupStepEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @Column({ type: 'uuid', name: 'company_id' })
  companyId: string;

  @ManyToOne(() => CompanyEntity, (company) => company.setupSteps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;

  @Column({ type: 'enum', enum: SetupStepType, name: 'step_type' })
  stepType: SetupStepType;

  @Column({ type: 'smallint', name: 'step_order' })
  stepOrder: number;

  @Column({ type: 'enum', enum: SetupStepStatus, default: SetupStepStatus.INCOMPLETE })
  status: SetupStepStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'completed_by' })
  completedBy?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'external_reference_id' })
  externalReferenceId?: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
