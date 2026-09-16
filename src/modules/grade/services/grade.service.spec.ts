import { ConflictException } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { Grade, TransactionService } from '@new-hros/libs-sql';
import { CompanyEntity } from '../../company/entities/company.entity';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { OutboxEventRepository } from '../../company/repositories/outbox-event.repository';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { GradeRepository } from '../repositories/grade.repository';
import { GradeService } from './grade.service';

describe('GradeService - Multi-Company Isolation [US1]', () => {
  let service: GradeService;
  let mockGradeRepo: { [K in keyof GradeRepository]?: jest.Mock };
  let mockCompanyRepo: { [K in keyof CompanyRepository]?: jest.Mock };
  let mockSetupStepRepo: { [K in keyof CompanySetupStepRepository]?: jest.Mock };
  let mockTxService: { runInTransaction: jest.Mock };
  let mockOutboxRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-1',
      sessionId: 'sess-1',
      tenantCode: 'tenant-1',
      roles: ['admin'],
      scopes: [],
      permissions: ['grade:create'],
    });
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-A' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => Promise.resolve(dto as OutboxEventEntity)),
      save: jest.fn().mockResolvedValue({ id: 'outbox-1' } as OutboxEventEntity),
    };

    mockGradeRepo = {
      findByCode: jest.fn(),
      findById: jest.fn(),
      create: jest.fn().mockImplementation(async (data) => ({ id: 'grade-1', ...data }) as Grade),
    };

    mockCompanyRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'comp-A',
        timezone: 'UTC',
      } as unknown as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as never),
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new GradeService(
      mockTxService as unknown as TransactionService,
      mockGradeRepo as unknown as GradeRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      {} as unknown as EffectiveChangeRepository,
      mockOutboxRepo as unknown as OutboxEventRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should allow creating Grade code L3 in Company A when none exists in Company A', async () => {
    mockGradeRepo.findByCode!.mockResolvedValue(null);

    const result = await service.create(
      {
        code: 'L3',
        name: 'Senior Grade Level 3',
        effectiveAt: '2099-01-01T00:00:00Z',
      },
      'comp-A',
    );

    expect(result).toBeDefined();
    expect(mockGradeRepo.findByCode).toHaveBeenCalledWith('comp-A', 'L3');
    expect(mockGradeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'L3',
        name: 'Senior Grade Level 3',
      }),
    );
  });

  it('should reject creating duplicate Grade code L3 within the same Company A', async () => {
    mockGradeRepo.findByCode!.mockResolvedValue({
      id: 'existing-grade',
      code: 'L3',
      companyId: 'comp-A',
    } as Grade);

    await expect(
      service.create(
        {
          code: 'L3',
          name: 'Duplicate Grade',
          effectiveAt: '2099-01-01T00:00:00Z',
        },
        'comp-A',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should allow creating Grade code L3 in sibling Company B under same tenant', async () => {
    mockCompanyRepo.findById!.mockResolvedValue({
      id: 'comp-B',
      timezone: 'UTC',
    } as unknown as CompanyEntity);
    mockGradeRepo.findByCode!.mockResolvedValue(null);

    const result = await service.create(
      {
        code: 'L3',
        name: 'Company B Grade L3',
        effectiveAt: '2099-01-01T00:00:00Z',
      },
      'comp-B',
    );

    expect(result).toBeDefined();
    expect(mockGradeRepo.findByCode).toHaveBeenCalledWith('comp-B', 'L3');
    expect(mockGradeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'L3',
        name: 'Company B Grade L3',
      }),
    );
  });
});
