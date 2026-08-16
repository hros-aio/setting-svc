import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { EffectiveExecuteCommand, LocationApplyHandler } from '../handlers/location-apply.handler';
import { DepartmentApplyHandler } from '../handlers/department-apply.handler';
import { GradeApplyHandler } from '../handlers/grade-apply.handler';

@Injectable()
export class EffectiveChangeService {
  private readonly logger = new Logger(EffectiveChangeService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionService: TransactionService,
    private readonly locationApplyHandler: LocationApplyHandler,
    private readonly departmentApplyHandler: DepartmentApplyHandler,
    private readonly gradeApplyHandler: GradeApplyHandler,
  ) {}

  async executeChange(command: EffectiveExecuteCommand): Promise<void> {
    this.logger.log(
      `Executing effective change: ${command.changeId} (Entity: ${command.entityType}, Op: ${command.operation})`,
    );

    return this.transactionService.runInTransaction(async () => {
      const em = this.dataSource.manager;

      const entityType = command.entityType.toLowerCase();
      if (entityType === 'location') {
        await this.locationApplyHandler.apply(command, em);
      } else if (entityType === 'department') {
        await this.departmentApplyHandler.apply(command, em);
      } else if (entityType === 'grade') {
        await this.gradeApplyHandler.apply(command, em);
      } else {
        this.logger.warn(`Handler for entity type '${command.entityType}' not yet registered`);
      }
    });
  }
}
