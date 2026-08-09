import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { CompanyEntity } from '../../company/entities/company.entity';
import { TenantEntity } from '../../tenant/entities/tenant.entity';
import { DepartmentEntity } from '../../department/entities/department.entity';
import { GradeEntity } from '../../grade/entities/grade.entity';
import { MasterDataStatus } from '../../../common/enums/domain-enums';

@Entity('job_titles')
@Unique('uq_job_titles_company_code', ['companyId', 'code'])
export class JobTitleEntity {
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

  @Column({ type: 'uuid', name: 'department_id' })
  departmentId: string;

  @ManyToOne(() => DepartmentEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department: DepartmentEntity;

  @Column({ type: 'uuid', name: 'grade_id' })
  gradeId: string;

  @ManyToOne(() => GradeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'grade_id' })
  grade: GradeEntity;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'uuid', nullable: true, name: 'source_job_title_id' })
  sourceJobTitleId?: string;

  @ManyToOne(() => JobTitleEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_job_title_id' })
  sourceJobTitle?: JobTitleEntity;

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
