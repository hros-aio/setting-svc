import { EventEnvelope } from '@new-hros/libs-events';
import { KafkaTopic } from '../enums';
import { CompanyProvisioningService } from '../modules/company/services/company-provisioning.service';
import { TenantCreatedPayload, TenantProvisioningHandler } from './tenant-provisioning.handler';

describe('TenantProvisioningConsumer', () => {
  let consumer: TenantProvisioningHandler;
  let mockCompanyProvisioningService: jest.Mocked<Partial<CompanyProvisioningService>>;

  beforeEach(() => {
    mockCompanyProvisioningService = {
      provisionCompanyOnTenantCreated: jest
        .fn()
        .mockResolvedValue({ success: true, companyId: 'c-1' }),
    };
    consumer = new TenantProvisioningHandler(
      mockCompanyProvisioningService as unknown as CompanyProvisioningService,
    );
  });

  it('should ignore events that have no payload or tenantCode', async () => {
    const envelope = {
      id: 'evt-1',
      topic: KafkaTopic.TENANT_CREATED,
      payload: { name: 'Acme' } as unknown as TenantCreatedPayload,
      producer: 'tenant-svc',
      version: '1.0',
      timestamp: new Date().toISOString(),
      correlationId: 'c-1',
    } as unknown as EventEnvelope<TenantCreatedPayload>;

    await consumer.handleTenantLifecycleEvent(envelope);
    expect(mockCompanyProvisioningService.provisionCompanyOnTenantCreated).not.toHaveBeenCalled();
  });

  it('should process tenant.created event and propagate to CompanyProvisioningService', async () => {
    const envelope: EventEnvelope<TenantCreatedPayload> = {
      id: 'evt-100',
      correlationId: 'corr-100',
      topic: KafkaTopic.TENANT_CREATED,
      producer: 'tenant-svc',
      version: '1.0',
      timestamp: new Date().toISOString(),
      payload: {
        id: 'ext-t-1',
        tenantCode: 'ACME',
        name: 'Acme Global',
        legalName: 'Acme Global Inc',
      },
    };

    const result = await consumer.handleTenantLifecycleEvent(envelope);

    expect(result).toEqual({ success: true, companyId: 'c-1' });
    expect(mockCompanyProvisioningService.provisionCompanyOnTenantCreated).toHaveBeenCalledWith(
      'evt-100',
      KafkaTopic.TENANT_CREATED,
      envelope.payload,
    );
  });
});
