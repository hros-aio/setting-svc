import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CompanyEntity } from '../../company/entities/company.entity';
import { DepartmentEntity } from '../../department/entities/department.entity';
import { GradeEntity } from '../../grade/entities/grade.entity';
import { JobTitleEntity } from '../../job-title/entities/job-title.entity';
import { LocationEntity } from '../../location/entities/location.entity';
import { TenantEntity } from '../../tenant/entities/tenant.entity';
import { EmployeeTransferStatus, TableName } from '../../../enums';

@Entity(TableName.EMPLOYEE_TRANSFERS)
@Index('idx_employee_transfers_tenant_emp', ['tenantId', 'employeeId'])
@Index('idx_employee_transfers_status_eff', ['status', 'effectiveAt'])
@Index('idx_employee_transfers_dest_co', ['tenantId', 'destinationCompanyId'])
@Index('idx_employee_transfers_src_co', ['tenantId', 'sourceCompanyId'])
export class EmployeeTransferEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @Column({ type: 'uuid', name: 'source_company_id' })
  sourceCompanyId: string;

  @ManyToOne(() => CompanyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_company_id' })
  sourceCompany: CompanyEntity;

  @Column({ type: 'uuid', name: 'destination_company_id' })
  destinationCompanyId: string;

  @ManyToOne(() => CompanyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_company_id' })
  destinationCompany: CompanyEntity;

  @Column({ type: 'uuid', nullable: true, name: 'destination_location_id' })
  destinationLocationId?: string;

  @ManyToOne(() => LocationEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_location_id' })
  destinationLocation?: LocationEntity;

  @Column({ type: 'uuid', nullable: true, name: 'destination_department_id' })
  destinationDepartmentId?: string;

  @ManyToOne(() => DepartmentEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_department_id' })
  destinationDepartment?: DepartmentEntity;

  @Column({ type: 'uuid', nullable: true, name: 'destination_grade_id' })
  destinationGradeId?: string;

  @ManyToOne(() => GradeEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_grade_id' })
  destinationGrade?: GradeEntity;

  @Column({ type: 'uuid', nullable: true, name: 'destination_job_title_id' })
  destinationJobTitleId?: string;

  @ManyToOne(() => JobTitleEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_job_title_id' })
  destinationJobTitle?: JobTitleEntity;

  @Column({
    type: 'varchar',
    length: 32,
    default: EmployeeTransferStatus.PENDING,
  })
  status: EmployeeTransferStatus;

  @Column({ type: 'timestamptz', name: 'effective_at' })
  effectiveAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy?: string;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
