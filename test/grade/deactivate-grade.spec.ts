import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { GradeService } from '../../src/modules/grade/services/grade.service';
import {
  AggregateType,
  ChangeOperation,
  EffectiveChangeEventType,
  EffectiveChangeStatus,
  MasterDataStatus,
} from '../../src/enums';
import { GradeRepository } from '../../src/modules/grade/repositories/grade.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';
import { OutboxEventRepository } from '../../src/modules/company/repositories/outbox-event.repository';
import { TransactionService } from '@new-hros/libs-sql';
import { RequestContextService } from '@new-hros/libs-core';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { Grade } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';

describe('GradeService - Schedule Grade Deactivation [US4]', () => {
  let service: GradeService;
  let mockGradeRepo: jest.Mocked<Partial<GradeRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockEffectiveChangeRepo: jest.Mocked<Partial<EffectiveChangeRepository>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockOutboxRepo: jest.Mocked<Partial<OutboxEventRepository>>;

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-1',
      sessionId: 'sess-1',
      tenantCode: 'tenant-1',
      roles: ['admin'],
      scopes: [],
      permissions: ['grade:deactivate'],
    });
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-1' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => Promise.resolve(dto as OutboxEventEntity)),
    };

    mockGradeRepo = {
      findById: jest.fn(),
    };

    mockCompanyRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'comp-1',
        timezone: 'UTC',
      } as unknown as CompanyEntity),
    };

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ id: 'change-1', ...data } as unknown as EffectiveChangeEntity),
        ),
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation(async (cb) => cb()),
    };

    service = new GradeService(
      mockTxService as unknown as TransactionService,
      mockGradeRepo as unknown as GradeRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      {} as unknown as CompanySetupStepRepository,
      mockEffectiveChangeRepo as unknown as EffectiveChangeRepository,
      mockOutboxRepo as unknown as OutboxEventRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject if grade not found', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockGradeRepo.findById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.scheduleDeactivation('invalid-id', { effectiveAt: futureDate }, 'comp-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject if grade is already inactive', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockGradeRepo.findById as jest.Mock).mockResolvedValue({
      id: 'grade-1',
      status: MasterDataStatus.INACTIVE,
    } as Grade);

    await expect(
      service.scheduleDeactivation('grade-1', { effectiveAt: futureDate }, 'comp-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject if pending change exists on grade', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockGradeRepo.findById as jest.Mock).mockResolvedValue({
      id: 'grade-1',
      status: MasterDataStatus.ACTIVE,
    } as Grade);
    (mockEffectiveChangeRepo.findPendingChange as jest.Mock).mockResolvedValue({
      id: 'existing-change',
      status: EffectiveChangeStatus.SCHEDULED,
    } as EffectiveChangeEntity);

    await expect(
      service.scheduleDeactivation('grade-1', { effectiveAt: futureDate }, 'comp-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('should successfully schedule deactivation in effective_changes and emit outbox event', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    const mockGrade = {
      id: 'grade-1',
      code: 'L3',
      name: 'Senior Software Engineer',
      status: MasterDataStatus.ACTIVE,
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    } as Grade;

    (mockGradeRepo.findById as jest.Mock).mockResolvedValue(mockGrade);

    const result = await service.scheduleDeactivation(
      'grade-1',
      { effectiveAt: futureDate },
      'comp-1',
    );

    expect(result.id).toBe('change-1');
    expect(result.operation).toBe(ChangeOperation.DEACTIVATE);
    expect(result.status).toBe(EffectiveChangeStatus.SCHEDULED);
    expect(mockOutboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: AggregateType.EFFECTIVE_CHANGE,
        eventType: EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED,
      }),
    );
  });
});
