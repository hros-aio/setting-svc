import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TableName, OutboxStatus } from '../../../enums';

@Entity(TableName.OUTBOX_EVENTS)
export class OutboxEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128, name: 'aggregate_type' })
  aggregateType: string;

  @Column({ type: 'varchar', length: 128, name: 'aggregate_id' })
  aggregateId: string;

  @Column({ type: 'varchar', length: 128, name: 'event_type' })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 32, default: OutboxStatus.PENDING })
  status: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
