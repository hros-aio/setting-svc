import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { RequestContext, RequestContextService } from '@new-hros/libs-core';
import { EventEnvelope } from '@new-hros/libs-events';
import { KafkaTopic } from '../enums';
import { CompanyProvisioningService } from '../modules/company/services/company-provisioning.service';

export interface TenantCreatedPayload {
  id: string;
  tenantCode: string;
  name: string;
  legalName?: string;
  displayName?: string;
  countryCode?: string;
  currencyCode?: string;
  timezone?: string;
  sourceVersion?: number | string;
}

@Controller()
export class TenantProvisioningHandler {
  private readonly logger = new Logger(TenantProvisioningHandler.name);

  constructor(private readonly companyProvisioningService: CompanyProvisioningService) {}

  @EventPattern(KafkaTopic.TENANT_CREATED)
  async handleTenantLifecycleEvent(
    @Payload() envelope: EventEnvelope<TenantCreatedPayload>,
  ): Promise<unknown> {
    const payload = envelope.payload;
    if (!payload || !payload.tenantCode) {
      this.logger.warn(`Received tenant event without tenantCode: ${JSON.stringify(envelope)}`);
      return;
    }

    const context: RequestContext = {
      traceId: envelope.correlationId || envelope.id,
      requestId: envelope.id,
      tenantCode: payload.tenantCode,
      clientMetadata: {
        ip: '127.0.0.1',
      },
      requestTimestamp: new Date(),
    };

    return RequestContextService.run(context, async () => {
      this.logger.log(
        `Processing tenant provisioning for tenantCode: ${payload.tenantCode} (eventId: ${envelope.id})`,
      );
      return this.companyProvisioningService.provisionCompanyOnTenantCreated(
        envelope.id,
        envelope.topic || KafkaTopic.TENANT_CREATED,
        payload,
      );
    });
  }
}
