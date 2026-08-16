import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDepartmentSchema1723900000000 implements MigrationInterface {
  name = 'CreateDepartmentSchema1723900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        code varchar(64) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        parent_department_id uuid REFERENCES departments(id) ON DELETE RESTRICT,
        status varchar(32) NOT NULL DEFAULT 'scheduled',
        effective_at timestamptz NOT NULL,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_departments_company_code UNIQUE (company_id, code),
        CONSTRAINT ck_departments_not_self_parent CHECK (parent_department_id IS NULL OR parent_department_id <> id)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_tenant_company
      ON departments (tenant_id, company_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_company_status
      ON departments (company_id, status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_parent
      ON departments (parent_department_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_departments_parent;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_departments_company_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_departments_tenant_company;`);
    await queryRunner.query(`DROP TABLE IF EXISTS departments;`);
  }
}
