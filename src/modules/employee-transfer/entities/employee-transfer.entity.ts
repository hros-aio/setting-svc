import { BaseEntity, Department, Grade, JobTitle, Location } from '@new-hros/libs-sql';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EmployeeTransferStatus, TableName } from '../../../enums';
import { CompanyEntity } from '../../company/entities/company.entity';

@Entity(TableName.EMPLOYEE_TRANSFERS)
@Index('idx_employee_transfers_tenant_emp', ['tenantCode', 'employeeId'])
@Index('idx_employee_transfers_status_eff', ['status', 'effectiveAt'])
@Index('idx_employee_transfers_dest_co', ['tenantCode', 'destinationCompanyId'])
@Index('idx_employee_transfers_src_co', ['tenantCode', 'sourceCompanyId'])
export class EmployeeTransferEntity extends BaseEntity {
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

  @ManyToOne(() => Location, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_location_id' })
  destinationLocation?: Location;

  @Column({ type: 'uuid', nullable: true, name: 'destination_department_id' })
  destinationDepartmentId?: string;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_department_id' })
  destinationDepartment?: Department;

  @Column({ type: 'uuid', nullable: true, name: 'destination_grade_id' })
  destinationGradeId?: string;

  @ManyToOne(() => Grade, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_grade_id' })
  destinationGrade?: Grade;

  @Column({ type: 'uuid', nullable: true, name: 'destination_job_title_id' })
  destinationJobTitleId?: string;

  @ManyToOne(() => JobTitle, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_job_title_id' })
  destinationJobTitle?: JobTitle;

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
}
