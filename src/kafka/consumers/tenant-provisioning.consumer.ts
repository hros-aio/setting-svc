import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { RequestContextService, RequestContext } from '@new-hros/libs-core';
import { EventEnvelope } from '@new-hros/libs-events';
import {
  TenantCreatedPayload,
  TenantLifecycleEventType,
} from '../types/tenant-lifecycle-events.types';
import { KafkaTopic } from '../../enums';
import { CompanyProvisioningService } from '../../modules/company/services/company-provisioning.service';

@Controller()
export class TenantProvisioningConsumer {
  private readonly logger = new Logger(TenantProvisioningConsumer.name);

  constructor(private readonly companyProvisioningService: CompanyProvisioningService) {}

  @EventPattern(KafkaTopic.TENANT_LIFECYCLE_EVENTS)
  async handleTenantLifecycleEvent(
    @Payload() envelope: EventEnvelope<TenantCreatedPayload> & { eventType?: string },
  ): Promise<unknown> {
    const eventType =
      envelope.eventType ||
      (envelope as unknown as { payload?: { eventType?: string } }).payload?.eventType ||
      TenantLifecycleEventType.TENANT_CREATED;

    if (
      eventType !== TenantLifecycleEventType.TENANT_CREATED &&
      eventType !== TenantLifecycleEventType.TENANT_PROVISIONED
    ) {
      return;
    }

    const payload = envelope.payload?.tenantCode
      ? envelope.payload
      : (envelope as unknown as { payload?: { payload?: TenantCreatedPayload } }).payload
          ?.payload || envelope.payload;

    if (!payload || !payload.tenantCode) {
      this.logger.warn(`Received tenant event without tenantCode: ${JSON.stringify(envelope)}`);
      return;
    }

    const context: RequestContext = {
      traceId: envelope.correlationId || envelope.id,
      requestId: envelope.id,
      serviceName: 'hrms-setting-service',
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
        envelope.topic || KafkaTopic.TENANT_LIFECYCLE_EVENTS,
        payload,
      );
    });
  }
}
