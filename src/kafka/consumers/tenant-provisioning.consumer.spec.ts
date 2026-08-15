import { TenantProvisioningConsumer } from './tenant-provisioning.consumer';
import { CompanyProvisioningService } from '../../modules/company/services/company-provisioning.service';
import {
  TenantLifecycleEventType,
  TenantCreatedPayload,
} from '../types/tenant-lifecycle-events.types';
import { EventEnvelope } from '@new-hros/libs-events';

describe('TenantProvisioningConsumer', () => {
  let consumer: TenantProvisioningConsumer;
  let mockCompanyProvisioningService: jest.Mocked<Partial<CompanyProvisioningService>>;

  beforeEach(() => {
    mockCompanyProvisioningService = {
      provisionCompanyOnTenantCreated: jest
        .fn()
        .mockResolvedValue({ success: true, companyId: 'c-1' }),
    };
    consumer = new TenantProvisioningConsumer(
      mockCompanyProvisioningService as unknown as CompanyProvisioningService,
    );
  });

  it('should ignore events that are not tenant.created or tenant.provisioned', async () => {
    const envelope = {
      id: 'evt-1',
      topic: 'tenant.lifecycle-events',
      eventType: 'tenant.deleted',
      payload: { tenantCode: 'ACME', name: 'Acme', tenantId: 't-1' },
      producer: 'tenant-svc',
      version: '1.0',
      timestamp: new Date().toISOString(),
      correlationId: 'c-1',
    } as unknown as EventEnvelope<TenantCreatedPayload> & { eventType?: string };

    await consumer.handleTenantLifecycleEvent(envelope);
    expect(mockCompanyProvisioningService.provisionCompanyOnTenantCreated).not.toHaveBeenCalled();
  });

  it('should process tenant.created event and propagate to CompanyProvisioningService', async () => {
    const envelope: EventEnvelope<TenantCreatedPayload> & { eventType?: string } = {
      id: 'evt-100',
      correlationId: 'corr-100',
      topic: 'tenant.lifecycle-events',
      eventType: TenantLifecycleEventType.TENANT_CREATED,
      producer: 'tenant-svc',
      version: '1.0',
      timestamp: new Date().toISOString(),
      payload: {
        tenantId: 'ext-t-1',
        tenantCode: 'ACME',
        name: 'Acme Global',
        legalName: 'Acme Global Inc',
      },
    };

    const result = await consumer.handleTenantLifecycleEvent(envelope);

    expect(result).toEqual({ success: true, companyId: 'c-1' });
    expect(mockCompanyProvisioningService.provisionCompanyOnTenantCreated).toHaveBeenCalledWith(
      'evt-100',
      'tenant.lifecycle-events',
      envelope.payload,
    );
  });

  it('should process tenant.provisioned event alias successfully', async () => {
    const envelope: EventEnvelope<TenantCreatedPayload> & { eventType?: string } = {
      id: 'evt-101',
      topic: 'tenant.lifecycle-events',
      eventType: TenantLifecycleEventType.TENANT_PROVISIONED,
      correlationId: 'corr-101',
      producer: 'tenant-svc',
      version: '1.0',
      timestamp: new Date().toISOString(),
      payload: {
        tenantId: 'ext-t-2',
        tenantCode: 'BETA',
        name: 'Beta LLC',
      },
    };

    const result = await consumer.handleTenantLifecycleEvent(envelope);

    expect(result).toEqual({ success: true, companyId: 'c-1' });
    expect(mockCompanyProvisioningService.provisionCompanyOnTenantCreated).toHaveBeenCalledWith(
      'evt-101',
      'tenant.lifecycle-events',
      envelope.payload,
    );
  });
});
