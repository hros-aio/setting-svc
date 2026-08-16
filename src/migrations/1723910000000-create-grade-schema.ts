import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGradeSchema1723910000000 implements MigrationInterface {
  name = 'CreateGradeSchema1723910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS grades (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        code varchar(64) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        rank_order integer,
        source_grade_id uuid REFERENCES grades(id) ON DELETE SET NULL,
        status varchar(32) NOT NULL DEFAULT 'scheduled',
        effective_at timestamptz NOT NULL,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_grades_company_code UNIQUE (company_id, code)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_grades_tenant_company
      ON grades (tenant_id, company_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_grades_company_status
      ON grades (company_id, status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_grades_company_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_grades_tenant_company;`);
    await queryRunner.query(`DROP TABLE IF EXISTS grades;`);
  }
}
