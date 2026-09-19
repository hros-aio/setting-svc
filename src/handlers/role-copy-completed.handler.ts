import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CacheService } from '@new-hros/libs-core';
import { EventEnvelope } from '@new-hros/libs-events';
import { KafkaTopic, SetupStepStatus, SetupStepType } from '../enums';
import { CompanySetupStepRepository } from '../modules/company/repositories/company-setup-step.repository';

export interface RoleCopyCompletedPayload {
  batchId: string;
  tenantCode: string;
  sourceCompanyId: string;
  targetCompanyId: string;
  copiedRoleCount?: number;
}

@Controller()
export class RoleCopyCompletedHandler {
  private readonly logger = new Logger(RoleCopyCompletedHandler.name);

  constructor(
    private readonly setupStepRepository: CompanySetupStepRepository,
    private readonly cacheService: CacheService,
  ) {}

  @EventPattern(KafkaTopic.AUTHORIZATION_ROLE_COPY_COMPLETED)
  async handleRoleCopyCompleted(
    @Payload() envelope: EventEnvelope<RoleCopyCompletedPayload>,
  ): Promise<void> {
    const payload = envelope.payload;
    if (!payload || !payload.targetCompanyId) {
      this.logger.warn(
        `Received authorization.role-copy.completed event without payload or targetCompanyId: ${JSON.stringify(
          envelope,
        )}`,
      );
      return;
    }

    const eventId = envelope.id || payload.batchId;
    const tenantCode = payload.tenantCode;
    const companyId = payload.targetCompanyId;

    // Idempotency check with Redis if available
    const idempotencyKey = `idemp:setup-step:${tenantCode}:${companyId}:role-copy:${eventId}`;
    const { executed } = await this.cacheService.executeIfAbsent(
      idempotencyKey,
      async () => {
        const step = await this.setupStepRepository.findByCompanyAndStep(
          companyId,
          SetupStepType.ROLE,
        );

        if (!step) {
          this.logger.warn(`Setup step ROLE not found for targetCompanyId: ${companyId}`);
          return;
        }

        if (step.status === SetupStepStatus.COMPLETED) {
          this.logger.log(
            `Setup step ROLE for company ${companyId} is already COMPLETED. Skipping.`,
          );
          if (this.cacheService) {
            await this.cacheService.set(idempotencyKey, true, 86400);
          }
          return;
        }

        await this.setupStepRepository.markStepCompleted({
          companyId,
          stepType: SetupStepType.ROLE,
          externalReferenceId: payload.batchId,
          metadata: {
            ...(step.metadata || {}),
            roleCount: payload.copiedRoleCount ?? 0,
            sourceCompanyId: payload.sourceCompanyId,
          },
        });
        this.logger.log(
          `Marked setup step ROLE as COMPLETED for company ${companyId} (batch: ${payload.batchId})`,
        );
      },
      86400,
    );

    if (!executed) {
      this.logger.log(
        `Duplicate authorization.role-copy.completed event received for company ${companyId}. Skipping.`,
      );
      return;
    }
  }
}
