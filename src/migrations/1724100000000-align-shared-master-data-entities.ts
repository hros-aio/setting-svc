import { MigrationInterface, QueryRunner } from 'typeorm';

const SHARED_ENTITY_TABLES = ['companies', 'locations', 'departments', 'grades', 'job_titles'];

export class AlignSharedMasterDataEntities1724100000000 implements MigrationInterface {
  name = 'AlignSharedMasterDataEntities1724100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_shared_entity_tenant_code()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.tenant_code IS NULL THEN
          SELECT tenant_code INTO NEW.tenant_code
          FROM tenants
          WHERE id = NEW.tenant_id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    for (const table of SHARED_ENTITY_TABLES) {
      await queryRunner.query(`
        ALTER TABLE ${table}
          ADD COLUMN IF NOT EXISTS tenant_code varchar(64),
          ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
          ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1
      `);
      await queryRunner.query(`
        UPDATE ${table} entity
        SET tenant_code = tenant.tenant_code
        FROM tenants tenant
        WHERE tenant.id = entity.tenant_id
          AND entity.tenant_code IS NULL
      `);
      await queryRunner.query(`
        ALTER TABLE ${table}
          ALTER COLUMN tenant_code SET NOT NULL
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_${table}_tenant_code
          ON ${table} (tenant_code)
      `);
      await queryRunner.query(`
        DROP TRIGGER IF EXISTS trg_${table}_tenant_code ON ${table}
      `);
      await queryRunner.query(`
        CREATE TRIGGER trg_${table}_tenant_code
        BEFORE INSERT OR UPDATE OF tenant_id ON ${table}
        FOR EACH ROW EXECUTE FUNCTION set_shared_entity_tenant_code()
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...SHARED_ENTITY_TABLES].reverse()) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS trg_${table}_tenant_code ON ${table}`);
      await queryRunner.query(`DROP INDEX IF EXISTS idx_${table}_tenant_code`);
      await queryRunner.query(`
        ALTER TABLE ${table}
          DROP COLUMN IF EXISTS version,
          DROP COLUMN IF EXISTS deleted_at,
          DROP COLUMN IF EXISTS tenant_code
      `);
    }
    await queryRunner.query('DROP FUNCTION IF EXISTS set_shared_entity_tenant_code()');
  }
}
