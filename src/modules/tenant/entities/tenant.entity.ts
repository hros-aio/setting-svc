import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { CompanyEntity } from '../../company/entities/company.entity';

@Entity('tenants')
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true, name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'varchar', length: 64, unique: true, name: 'tenant_code' })
  tenantCode: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'bigint', default: 0, name: 'source_version' })
  sourceVersion: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => CompanyEntity, (company) => company.tenant)
  companies: CompanyEntity[];
}
