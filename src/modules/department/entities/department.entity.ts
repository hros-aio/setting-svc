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
import { CompanyEntity } from '../../company/entities/company.entity';
import { TenantEntity } from '../../tenant/entities/tenant.entity';
import { MasterDataStatus, TableName } from '../../../enums';

@Entity(TableName.DEPARTMENTS)
@Unique('uq_departments_company_code', ['companyId', 'code'])
@Check(
  'ck_departments_not_self_parent',
  `parent_department_id IS NULL OR parent_department_id <> id`,
)
export class DepartmentEntity {
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

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'uuid', nullable: true, name: 'parent_department_id' })
  parentDepartmentId?: string;

  @ManyToOne(() => DepartmentEntity, (dept) => dept.children, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_department_id' })
  parentDepartment?: DepartmentEntity;

  @OneToMany(() => DepartmentEntity, (dept) => dept.parentDepartment)
  children: DepartmentEntity[];

  @Column({ type: 'enum', enum: MasterDataStatus, default: MasterDataStatus.SCHEDULED })
  status: MasterDataStatus;

  @Column({ type: 'timestamptz', name: 'effective_at' })
  effectiveAt: Date;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy?: string;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
