import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EventEnvelope } from '@new-hros/libs-events';
import { KafkaTopic, SetupStepStatus, SetupStepType } from '../../enums';
import { CompanySetupStepRepository } from '../../modules/company/repositories/company-setup-step.repository';

export interface RoleCopyCompletedPayload {
  batchId: string;
  tenantId: string;
  sourceCompanyId: string;
  targetCompanyId: string;
  copiedRoleCount?: number;
}

@Controller()
export class RoleCopyCompletedConsumer {
  private readonly logger = new Logger(RoleCopyCompletedConsumer.name);

  constructor(private readonly setupStepRepository: CompanySetupStepRepository) {}

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

    const step = await this.setupStepRepository.findByCompanyAndStep(
      payload.targetCompanyId,
      SetupStepType.ROLE,
    );

    if (!step) {
      this.logger.warn(`Setup step ROLE not found for targetCompanyId: ${payload.targetCompanyId}`);
      return;
    }

    if (step.status === SetupStepStatus.COMPLETED) {
      this.logger.log(
        `Setup step ROLE for company ${payload.targetCompanyId} is already COMPLETED. Skipping.`,
      );
      return;
    }

    step.status = SetupStepStatus.COMPLETED;
    step.completedAt = new Date();
    step.externalReferenceId = payload.batchId;
    step.metadata = {
      ...(step.metadata || {}),
      roleCount: payload.copiedRoleCount ?? 0,
      sourceCompanyId: payload.sourceCompanyId,
    };

    await this.setupStepRepository.save(step);
    this.logger.log(
      `Marked setup step ROLE as COMPLETED for company ${payload.targetCompanyId} (batch: ${payload.batchId})`,
    );
  }
}
