import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExecutionTimeToOutboxEvents1724200000000 implements MigrationInterface {
  name = 'AddExecutionTimeToOutboxEvents1724200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE outbox_events
        ADD COLUMN IF NOT EXISTS execution_time timestamptz;
    `);

    await queryRunner.query(`
      UPDATE outbox_events
      SET execution_time = COALESCE(
        CASE
          WHEN event_type = 'setting.effective-change.scheduled' AND payload->>'effectiveAt' IS NOT NULL
            THEN (payload->>'effectiveAt')::timestamptz
          ELSE created_at
        END,
        now()
      )
      WHERE execution_time IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE outbox_events
        ALTER COLUMN execution_time SET NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_outbox_events_execution_time_status
        ON outbox_events (execution_time, status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_outbox_events_execution_time_status;
    `);

    await queryRunner.query(`
      ALTER TABLE outbox_events
        DROP COLUMN IF EXISTS execution_time;
    `);
  }
}
