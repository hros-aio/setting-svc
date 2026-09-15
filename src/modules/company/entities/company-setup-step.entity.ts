import { BaseEntity } from '@new-hros/libs-sql';
import { Check, Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { SetupStepStatus, SetupStepType, TableName } from '../../../enums';
import { CompanyEntity } from './company.entity';

@Entity(TableName.COMPANY_SETUP_STEPS)
@Unique('uq_company_setup_step', ['companyId', 'stepType'])
@Unique('uq_company_setup_order', ['companyId', 'stepOrder'])
@Check('ck_company_setup_order', `step_order BETWEEN 1 AND 8`)
@Check(
  'ck_company_setup_completion',
  `(status = 'incomplete' AND completed_at IS NULL) OR (status = 'completed' AND completed_at IS NOT NULL)`,
)
export class CompanySetupStepEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId: string;

  @ManyToOne(() => CompanyEntity, (company) => company.setupSteps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;

  @Column({
    type: 'enum',
    enum: SetupStepType,
    enumName: 'setup_step_type',
    name: 'step_type',
  })
  stepType: SetupStepType;

  @Column({ type: 'smallint', name: 'step_order' })
  stepOrder: number;

  @Column({
    type: 'enum',
    enum: SetupStepStatus,
    enumName: 'setup_step_status',
    default: SetupStepStatus.INCOMPLETE,
  })
  status: SetupStepStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'completed_by' })
  completedBy?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'external_reference_id' })
  externalReferenceId?: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;
}
