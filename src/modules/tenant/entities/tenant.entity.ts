import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TableName } from '../../../enums';

@Entity(TableName.TENANTS)
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true, name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'varchar', length: 64, unique: true, name: 'tenant_code' })
  tenantCode: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'bigint',
    default: '0',
    name: 'source_version',
    transformer: {
      to: (value: string | number): string => String(value ?? 0),
      from: (value: string | number): string => String(value ?? 0),
    },
  })
  sourceVersion: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
