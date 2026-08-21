import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { CompanyProvisioningService } from '../src/modules/company/services/company-provisioning.service';
import { TenantProvisioningConsumer } from '../src/kafka/consumers/tenant-provisioning.consumer';
import {
  SetupStepType,
  SetupStepStatus,
  CompanyStatus,
  CompanyEventType,
  TenantLifecycleEventType,
  KafkaTopic,
  AggregateType,
  OutboxStatus,
} from '../src/enums';
import { TenantCreatedPayload } from '../src/kafka/types/tenant-lifecycle-events.types';
import { EventEnvelope } from '@new-hros/libs-events';
import { TenantEntity } from '../src/modules/tenant/entities/tenant.entity';
import { CompanyEntity } from '../src/modules/company/entities/company.entity';
import { CompanySetupStepEntity } from '../src/modules/company/entities/company-setup-step.entity';
import { OutboxEventEntity } from '../src/modules/company/entities/outbox-event.entity';
import { TenantRepository } from '../src/modules/tenant/repositories/tenant.repository';
import { CompanyRepository } from '../src/modules/company/repositories/company.repository';
import { SetupStepSeederService } from '../src/modules/company/services/setup-step-seeder.service';

describe('Company Provisioning Workflow (E2E / Integration Simulation)', () => {
  let consumer: TenantProvisioningConsumer;

  const mockDb = {
    tenants: new Map<string, TenantEntity>(),
    companies: new Map<string, CompanyEntity>(),
    setupSteps: [] as CompanySetupStepEntity[],
    outboxEvents: [] as OutboxEventEntity[],
  };

  const mockTenantRepo = {
    upsertTenant: jest
      .fn()
      .mockImplementation(async (data: Partial<TenantEntity>): Promise<TenantEntity> => {
        const code = data.tenantCode ?? 'unknown';
        let record = mockDb.tenants.get(code);
        if (!record) {
          record = { id: `tenant-pk-${mockDb.tenants.size + 1}`, ...data } as TenantEntity;
          mockDb.tenants.set(code, record);
        } else {
          Object.assign(record, data);
        }
        return record;
      }),
  };

  const mockCompanyRepo = {
    findTemplateCompanyByTenantId: jest
      .fn()
      .mockImplementation(async (tenantId: string): Promise<CompanyEntity | null> => {
        for (const comp of mockDb.companies.values()) {
          if (comp.tenantId === tenantId && comp.isTemplate) {
            return comp;
          }
        }
        return null;
      }),
    findOneByTenantAndCode: jest
      .fn()
      .mockImplementation(
        async (tenantId: string, companyCode: string): Promise<CompanyEntity | null> => {
          for (const comp of mockDb.companies.values()) {
            if (comp.tenantId === tenantId && comp.companyCode === companyCode) {
              return comp;
            }
          }
          return null;
        },
      ),
    createAndSave: jest
      .fn()
      .mockImplementation(async (data: Partial<CompanyEntity>): Promise<CompanyEntity> => {
        const record = {
          id: `company-pk-${mockDb.companies.size + 1}`,
          ...data,
        } as CompanyEntity;
        mockDb.companies.set(record.id, record);
        return record;
      }),
  };

  const mockSetupStepRepo = {
    bulkCreateAndSave: jest
      .fn()
      .mockImplementation(
        async (steps: Partial<CompanySetupStepEntity>[]): Promise<CompanySetupStepEntity[]> => {
          const records = steps.map(
            (s, idx) => ({ id: `step-pk-${idx + 1}`, ...s }) as CompanySetupStepEntity,
          );
          mockDb.setupSteps.push(...records);
          return records;
        },
      ),
  };

  const mockOutboxRepo = {
    create: jest
      .fn()
      .mockImplementation(
        (dto: Partial<OutboxEventEntity>): OutboxEventEntity => dto as OutboxEventEntity,
      ),
    save: jest
      .fn()
      .mockImplementation(async (dto: Partial<OutboxEventEntity>): Promise<OutboxEventEntity> => {
        const record = {
          id: `outbox-${mockDb.outboxEvents.length + 1}`,
          ...dto,
        } as OutboxEventEntity;
        mockDb.outboxEvents.push(record);
        return record;
      }),
  };

  const mockEntityManager = {
    getRepository: jest.fn().mockReturnValue(mockOutboxRepo),
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockOutboxRepo),
    manager: mockEntityManager,
  };

  const mockTransactionService = {
    runInTransaction: jest
      .fn()
      .mockImplementation((cb: () => Promise<unknown>): Promise<unknown> => cb()),
  };

  beforeAll(async (): Promise<void> => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TenantProvisioningConsumer],
      providers: [
        CompanyProvisioningService,
        {
          provide: 'SetupStepSeederService',
          useValue: {
            seedMandatorySteps: async (
              tenantId: string,
              companyId: string,
            ): Promise<CompanySetupStepEntity[]> => {
              const types = [
                SetupStepType.COMPANY_INFORMATION,
                SetupStepType.LOCATION,
                SetupStepType.DEPARTMENT,
                SetupStepType.GRADE,
                SetupStepType.JOB_TITLE,
                SetupStepType.ROLE,
                SetupStepType.EMPLOYEE_IMPORT,
                SetupStepType.POC,
              ];
              const steps = types.map((t, i) => ({
                tenantId,
                companyId,
                stepType: t,
                stepOrder: i + 1,
                status: SetupStepStatus.INCOMPLETE,
              }));
              return mockSetupStepRepo.bulkCreateAndSave(steps);
            },
          },
        },
        { provide: 'TransactionService', useValue: mockTransactionService },
        { provide: 'DataSource', useValue: mockDataSource },
        { provide: 'TenantRepository', useValue: mockTenantRepo },
        { provide: 'CompanyRepository', useValue: mockCompanyRepo },
      ],
    })
      .overrideProvider(CompanyProvisioningService)
      .useFactory({
        factory: (seeder: SetupStepSeederService) => {
          return new CompanyProvisioningService(
            mockTransactionService as unknown as TransactionService,
            mockDataSource as unknown as DataSource,
            mockTenantRepo as unknown as TenantRepository,
            mockCompanyRepo as unknown as CompanyRepository,
            seeder,
          );
        },
        inject: ['SetupStepSeederService'],
      })
      .compile();

    consumer = moduleFixture.get<TenantProvisioningConsumer>(TenantProvisioningConsumer);
  });

  it('should provision tenant, template company (PENDING with isTemplate=true), 8 setup steps and outbox event when tenant.created is received', async () => {
    const event: EventEnvelope<TenantCreatedPayload> & { eventType?: string } = {
      id: 'event-uuid-001',
      correlationId: 'corr-001',
      producer: 'tenant-service',
      version: '1.0',
      timestamp: new Date().toISOString(),
      topic: KafkaTopic.TENANT_LIFECYCLE_EVENTS,
      eventType: TenantLifecycleEventType.TENANT_CREATED,
      payload: {
        tenantId: 'ext-tenant-001',
        tenantCode: 'ACME_GLOBAL',
        name: 'Acme Global Inc',
        legalName: 'Acme Global Incorporated',
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'America/New_York',
      },
    };

    const response = (await consumer.handleTenantLifecycleEvent(event)) as { success: boolean };

    expect(response.success).toBe(true);
    expect(mockDb.tenants.has('ACME_GLOBAL')).toBe(true);
    expect(mockDb.companies.size).toBe(1);

    const company = Array.from(mockDb.companies.values())[0];
    expect(company.companyCode).toBe('ACME_GLOBAL_HQ');
    expect(company.status).toBe(CompanyStatus.PENDING);
    expect(company.isTemplate).toBe(true);

    expect(mockDb.setupSteps).toHaveLength(8);
    expect(mockDb.setupSteps.every((s) => s.status === SetupStepStatus.INCOMPLETE)).toBe(true);

    expect(mockDb.outboxEvents).toHaveLength(1);
    expect(mockDb.outboxEvents[0].aggregateType).toBe(AggregateType.COMPANY);
    expect(mockDb.outboxEvents[0].eventType).toBe(CompanyEventType.COMPANY_CREATED);
    expect(mockDb.outboxEvents[0].status).toBe(OutboxStatus.PENDING);
  });

  it('should be idempotent and skip duplicate company creation if template company already exists for tenant', async () => {
    const event: EventEnvelope<TenantCreatedPayload> & { eventType?: string } = {
      id: 'event-uuid-002',
      correlationId: 'corr-002',
      producer: 'tenant-service',
      version: '1.0',
      timestamp: new Date().toISOString(),
      topic: KafkaTopic.TENANT_LIFECYCLE_EVENTS,
      eventType: TenantLifecycleEventType.TENANT_CREATED,
      payload: {
        tenantId: 'ext-tenant-001',
        tenantCode: 'ACME_GLOBAL',
        name: 'Acme Global Inc',
      },
    };

    const response = (await consumer.handleTenantLifecycleEvent(event)) as {
      success: boolean;
      reason?: string;
    };

    expect(response.success).toBe(true);
    expect(response.reason).toBe('ALREADY_EXISTS');
    expect(mockDb.companies.size).toBe(1);
    expect(mockDb.setupSteps).toHaveLength(8);
  });
});
