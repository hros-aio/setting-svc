import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobTitleSchema1723920000000 implements MigrationInterface {
  name = 'CreateJobTitleSchema1723920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS job_titles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        department_id uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
        grade_id uuid NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
        code varchar(64) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        source_job_title_id uuid REFERENCES job_titles(id) ON DELETE SET NULL,
        status varchar(32) NOT NULL DEFAULT 'scheduled',
        effective_at timestamptz NOT NULL,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_job_titles_company_code UNIQUE (company_id, code)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_titles_tenant_company
      ON job_titles (tenant_id, company_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_titles_company_status
      ON job_titles (company_id, status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_titles_department
      ON job_titles (department_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_titles_grade
      ON job_titles (grade_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_job_titles_grade;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_job_titles_department;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_job_titles_company_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_job_titles_tenant_company;`);
    await queryRunner.query(`DROP TABLE IF EXISTS job_titles;`);
  }
}
