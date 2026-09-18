import { Controller, Logger, Optional } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CacheService } from '@new-hros/libs-core';
import { EventEnvelope } from '@new-hros/libs-events';
import { KafkaTopic, SetupStepStatus, SetupStepType } from '../../enums';
import { CompanySetupStepRepository } from '../../modules/company/repositories/company-setup-step.repository';
import { EmployeeImportCompletedPayload } from '../types/setup-step-events.types';

@Controller()
export class EmployeeImportCompletedConsumer {
  private readonly logger = new Logger(EmployeeImportCompletedConsumer.name);

  constructor(
    private readonly setupStepRepository: CompanySetupStepRepository,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  @EventPattern(KafkaTopic.EMPLOYEE_IMPORT_BATCH_COMPLETED)
  async handleEmployeeImportCompleted(
    @Payload() envelope: EventEnvelope<EmployeeImportCompletedPayload>,
  ): Promise<void> {
    const payload = envelope.payload;
    if (!payload || !payload.companyId) {
      this.logger.warn(
        `Received employee-import.batch.completed event without payload or companyId: ${JSON.stringify(
          envelope,
        )}`,
      );
      return;
    }

    const eventId = envelope.id || payload.batchId;
    const tenantCode = payload.tenantCode;
    const companyId = payload.companyId;

    // Idempotency check with Redis if available
    const idempotencyKey = `idemp:setup-step:${tenantCode}:${companyId}:employee-import:${eventId}`;
    if (this.cacheService) {
      const alreadyProcessed = await this.cacheService.get<boolean>(idempotencyKey);
      if (alreadyProcessed) {
        this.logger.log(
          `Duplicate employee-import.batch.completed event received for company ${companyId}. Skipping.`,
        );
        return;
      }
    }

    const step = await this.setupStepRepository.findByCompanyAndStep(
      companyId,
      SetupStepType.EMPLOYEE_IMPORT,
    );

    if (!step) {
      this.logger.warn(`Setup step EMPLOYEE_IMPORT not found for company: ${companyId}`);
      return;
    }

    if (step.status === SetupStepStatus.COMPLETED) {
      this.logger.log(
        `Setup step EMPLOYEE_IMPORT for company ${companyId} is already COMPLETED. Skipping.`,
      );
      if (this.cacheService) {
        await this.cacheService.set(idempotencyKey, true, 86400);
      }
      return;
    }

    await this.setupStepRepository.markStepCompleted({
      companyId,
      stepType: SetupStepType.EMPLOYEE_IMPORT,
      externalReferenceId: payload.batchId,
      metadata: {
        ...(step.metadata || {}),
        importedCount: payload.importedCount ?? 0,
        ...(payload.metadata || {}),
      },
    });
    this.logger.log(
      `Marked setup step EMPLOYEE_IMPORT as COMPLETED for company ${companyId} (batch: ${payload.batchId})`,
    );

    if (this.cacheService) {
      await this.cacheService.set(idempotencyKey, true, 86400);
    }
  }
}
