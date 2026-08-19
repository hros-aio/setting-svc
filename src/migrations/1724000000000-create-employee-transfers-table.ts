import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployeeTransfersTable1724000000000 implements MigrationInterface {
  name = 'CreateEmployeeTransfersTable1724000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employee_transfers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        employee_id uuid NOT NULL,
        source_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
        destination_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
        destination_location_id uuid REFERENCES locations(id) ON DELETE RESTRICT,
        destination_department_id uuid REFERENCES departments(id) ON DELETE RESTRICT,
        destination_grade_id uuid REFERENCES grades(id) ON DELETE RESTRICT,
        destination_job_title_id uuid REFERENCES job_titles(id) ON DELETE RESTRICT,
        status varchar(32) NOT NULL DEFAULT 'PENDING',
        effective_at timestamptz NOT NULL,
        completed_at timestamptz,
        notes text,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_transfers_tenant_emp
      ON employee_transfers (tenant_id, employee_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_transfers_status_eff
      ON employee_transfers (status, effective_at);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_transfers_dest_co
      ON employee_transfers (tenant_id, destination_company_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_transfers_src_co
      ON employee_transfers (tenant_id, source_company_id);
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_pending_transfer
      ON employee_transfers (tenant_id, employee_id)
      WHERE status = 'PENDING';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_employee_pending_transfer;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_employee_transfers_src_co;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_employee_transfers_dest_co;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_employee_transfers_status_eff;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_employee_transfers_tenant_emp;`);
    await queryRunner.query(`DROP TABLE IF EXISTS employee_transfers;`);
  }
}
