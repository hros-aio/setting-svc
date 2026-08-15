import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { CompanyEntity } from '../../company/entities/company.entity';
import { TenantEntity } from '../../tenant/entities/tenant.entity';
import { ChangeOperation, EffectiveChangeStatus, TableName } from '../../../enums';

@Entity(TableName.EFFECTIVE_CHANGES)
@Check(
  'ck_effective_changes_entity_type',
  `entity_type IN ('location', 'department', 'grade', 'job_title', 'poc')`,
)
@Check('ck_effective_changes_cancelled', `status <> 'cancelled' OR cancelled_at IS NOT NULL`)
export class EffectiveChangeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @Column({ type: 'uuid', name: 'company_id' })
  companyId: string;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;

  @Column({ type: 'varchar', length: 64, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @Column({ type: 'enum', enum: ChangeOperation })
  operation: ChangeOperation;

  @Column({ type: 'timestamptz', name: 'effective_at' })
  effectiveAt: Date;

  @Column({ type: 'enum', enum: EffectiveChangeStatus, default: EffectiveChangeStatus.SCHEDULED })
  status: EffectiveChangeStatus;

  @Column({ type: 'jsonb', default: '{}' })
  payload: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true, name: 'expected_updated_at' })
  expectedUpdatedAt?: Date;

  @Column({ type: 'integer', default: 0, name: 'attempt_count' })
  attemptCount: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_attempted_at' })
  lastAttemptedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'processed_at' })
  processedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage?: string;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy?: string;

  @Column({ type: 'uuid', nullable: true, name: 'cancelled_by' })
  cancelledBy?: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'cancelled_at' })
  cancelledAt?: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
