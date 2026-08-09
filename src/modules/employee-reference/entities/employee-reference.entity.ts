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

@Entity('employee_references')
@Unique('uq_employee_references_tenant_employee', ['tenantId', 'employeeId'])
@Unique('uq_employee_references_company_number', ['companyId', 'employeeNumber'])
export class EmployeeReferenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @Column({ type: 'varchar', length: 128, name: 'employee_number' })
  employeeNumber: string;

  @Column({ type: 'uuid', name: 'company_id' })
  companyId: string;

  @ManyToOne(() => CompanyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'display_name' })
  displayName?: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'employment_status' })
  employmentStatus?: string;

  @Column({ type: 'bigint', default: 0, name: 'source_version' })
  sourceVersion: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'source_updated_at' })
  sourceUpdatedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
