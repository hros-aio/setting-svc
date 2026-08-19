import { Injectable, Logger } from '@nestjs/common';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource } from 'typeorm';
import { EffectiveEntityType } from '../../../enums';
import { DepartmentApplyHandler } from '../handlers/department-apply.handler';
import { EmployeeTransferApplyHandler } from '../handlers/employee-transfer-apply.handler';
import { GradeApplyHandler } from '../handlers/grade-apply.handler';
import { JobTitleApplyHandler } from '../handlers/job-title-apply.handler';
import { EffectiveExecuteCommand, LocationApplyHandler } from '../handlers/location-apply.handler';
import { PocApplyHandler } from '../handlers/poc-apply.handler';

@Injectable()
export class EffectiveChangeService {
  private readonly logger = new Logger(EffectiveChangeService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionService: TransactionService,
    private readonly locationApplyHandler: LocationApplyHandler,
    private readonly departmentApplyHandler: DepartmentApplyHandler,
    private readonly gradeApplyHandler: GradeApplyHandler,
    private readonly jobTitleApplyHandler: JobTitleApplyHandler,
    private readonly pocApplyHandler: PocApplyHandler,
    private readonly employeeTransferApplyHandler: EmployeeTransferApplyHandler,
  ) {}

  async executeChange(command: EffectiveExecuteCommand): Promise<void> {
    this.logger.log(
      `Executing effective change: ${command.changeId} (Entity: ${command.entityType}, Op: ${command.operation})`,
    );

    return this.transactionService.runInTransaction(async () => {
      const em = this.dataSource.manager;

      const entityType = command.entityType.toLowerCase();
      switch (entityType) {
        case EffectiveEntityType.LOCATION:
          await this.locationApplyHandler.apply(command, em);
          break;
        case EffectiveEntityType.DEPARTMENT:
          await this.departmentApplyHandler.apply(command, em);
          break;
        case EffectiveEntityType.GRADE:
          await this.gradeApplyHandler.apply(command, em);
          break;
        case EffectiveEntityType.JOB_TITLE:
        case EffectiveEntityType.JOBTITLE:
          await this.jobTitleApplyHandler.apply(command, em);
          break;
        case EffectiveEntityType.POC:
          await this.pocApplyHandler.apply(command, em);
          break;
        case EffectiveEntityType.EMPLOYEE_TRANSFER:
        case EffectiveEntityType.EMPLOYEETRANSFER:
        case EffectiveEntityType.EMPLOYEE_TRANSFER_KEBAB:
          await this.employeeTransferApplyHandler.apply(command, em);
          break;
        default:
          this.logger.warn(`Handler for entity type '${command.entityType}' not yet registered`);
          break;
      }
    });
  }
}
