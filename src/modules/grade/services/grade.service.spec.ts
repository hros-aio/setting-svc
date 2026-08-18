import { ConflictException } from '@nestjs/common';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource } from 'typeorm';
import { CompanyEntity } from '../../company/entities/company.entity';
import { OutboxEventEntity } from '../../company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { EffectiveChangeRepository } from '../../effective-change/repositories/effective-change.repository';
import { GradeEntity } from '../entities/grade.entity';
import { GradeRepository } from '../repositories/grade.repository';
import { GradeService } from './grade.service';

describe('GradeService - Multi-Company Isolation [US1]', () => {
  let service: GradeService;
  let mockGradeRepo: { [K in keyof GradeRepository]?: jest.Mock };
  let mockCompanyRepo: { [K in keyof CompanyRepository]?: jest.Mock };
  let mockSetupStepRepo: { [K in keyof CompanySetupStepRepository]?: jest.Mock };
  let mockDataSource: { manager: { getRepository: jest.Mock } };
  let mockTxService: { runInTransaction: jest.Mock };
  let mockOutboxRepo: { create: jest.Mock; save: jest.Mock };

  const mockAuthContextA: AuthContext = {
    userId: 'user-1',
    sessionId: 'sess-1',
    tenantCode: 'tenant-1',
    roles: ['admin'],
    scopes: [],
    permissions: ['grade:create'],
  };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-A' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => dto as OutboxEventEntity),
      save: jest.fn().mockResolvedValue({ id: 'outbox-1' } as OutboxEventEntity),
    };

    mockGradeRepo = {
      findByCode: jest.fn(),
      findById: jest.fn(),
      createAndSave: jest
        .fn()
        .mockImplementation((data) => ({ id: 'grade-1', ...data }) as GradeEntity),
    };

    mockCompanyRepo = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: 'comp-A',
        tenantId: 'tenant-1',
        timezone: 'UTC',
      } as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as never),
    };

    mockDataSource = {
      manager: {
        getRepository: jest.fn().mockReturnValue(mockOutboxRepo),
      },
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    service = new GradeService(
      mockDataSource as unknown as DataSource,
      mockTxService as unknown as TransactionService,
      mockGradeRepo as unknown as GradeRepository,
      mockCompanyRepo as unknown as CompanyRepository,
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
      {} as unknown as EffectiveChangeRepository,
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
      mockAuthContextA,
    );

    expect(result).toBeDefined();
    expect(mockGradeRepo.findByCode).toHaveBeenCalledWith('tenant-1', 'comp-A', 'L3');
    expect(mockGradeRepo.createAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        companyId: 'comp-A',
        code: 'L3',
      }),
      expect.anything(),
    );
  });

  it('should reject creating duplicate Grade code L3 within the same Company A', async () => {
    mockGradeRepo.findByCode!.mockResolvedValue({
      id: 'existing-grade',
      code: 'L3',
      companyId: 'comp-A',
    } as GradeEntity);

    await expect(
      service.create(
        {
          code: 'L3',
          name: 'Duplicate Grade',
          effectiveAt: '2099-01-01T00:00:00Z',
        },
        mockAuthContextA,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should allow creating Grade code L3 in sibling Company B under same tenant', async () => {
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-B' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);
    mockCompanyRepo.findByIdAndTenant!.mockResolvedValue({
      id: 'comp-B',
      tenantId: 'tenant-1',
      timezone: 'UTC',
    } as CompanyEntity);
    mockGradeRepo.findByCode!.mockResolvedValue(null);

    const result = await service.create(
      {
        code: 'L3',
        name: 'Company B Grade L3',
        effectiveAt: '2099-01-01T00:00:00Z',
      },
      mockAuthContextA,
    );

    expect(result).toBeDefined();
    expect(mockGradeRepo.findByCode).toHaveBeenCalledWith('tenant-1', 'comp-B', 'L3');
    expect(mockGradeRepo.createAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        companyId: 'comp-B',
        code: 'L3',
      }),
      expect.anything(),
    );
  });
});
