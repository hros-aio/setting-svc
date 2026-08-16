import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLocationSchema1723800000000 implements MigrationInterface {
  name = 'CreateLocationSchema1723800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        code varchar(64) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        country_code char(2),
        timezone varchar(64),
        address jsonb,
        is_headquarter boolean NOT NULL DEFAULT false,
        status varchar(32) NOT NULL DEFAULT 'scheduled',
        effective_at timestamptz NOT NULL,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_locations_company_code UNIQUE (company_id, code)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_locations_company_status
      ON locations (company_id, status);
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_one_headquarter_per_company
      ON locations (company_id)
      WHERE is_headquarter = true AND status <> 'inactive';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_locations_one_headquarter_per_company;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_locations_company_status;`);
    await queryRunner.query(`DROP TABLE IF EXISTS locations;`);
  }
}
