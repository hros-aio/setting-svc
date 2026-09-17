import { BaseEntity } from '@new-hros/libs-sql';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { MasterDataStatus, TableName } from '../../../enums';
import { CompanyEntity } from '../../company/entities/company.entity';

@Entity(TableName.POCS)
@Index('uq_pocs_one_active_per_type', ['companyId', 'pocType'], {
  unique: true,
  where: `"status" != 'inactive'`,
})
@Index('idx_pocs_tenant_company_status', ['tenantId', 'companyId', 'status'])
@Index('idx_pocs_employee_lookup', ['tenantId', 'employeeId'])
export class PocEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId: string;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;

  @Column({ type: 'varchar', length: 64, name: 'poc_type' })
  pocType: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @Column({ type: 'enum', enum: MasterDataStatus, default: MasterDataStatus.SCHEDULED })
  status: MasterDataStatus;

  @Column({ type: 'timestamptz', name: 'effective_at' })
  effectiveAt: Date;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy?: string;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy?: string;
}
