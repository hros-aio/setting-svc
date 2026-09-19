import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CacheService } from '@new-hros/libs-core';
import { EventEnvelope } from '@new-hros/libs-events';
import { KafkaTopic, SetupStepStatus, SetupStepType } from '../enums';
import { CompanySetupStepRepository } from '../modules/company/repositories/company-setup-step.repository';

export interface EmployeeImportCompletedPayload {
  batchId: string;
  tenantCode: string;
  companyId: string;
  importedCount?: number;
  metadata?: Record<string, unknown>;
}

@Controller()
export class EmployeeImportCompletedHandler {
  private readonly logger = new Logger(EmployeeImportCompletedHandler.name);

  constructor(
    private readonly setupStepRepository: CompanySetupStepRepository,
    private readonly cacheService: CacheService,
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
    const { executed } = await this.cacheService.executeIfAbsent(
      idempotencyKey,
      async () => {
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
      },
      86400,
    );

    if (!executed) {
      this.logger.log(
        `Duplicate employee-import.batch.completed event received for company ${companyId}. Skipping.`,
      );
      return;
    }
  }
}
