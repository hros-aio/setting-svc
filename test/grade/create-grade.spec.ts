import { BadRequestException, ConflictException } from '@nestjs/common';
import { GradeService } from '../../src/modules/grade/services/grade.service';
import { MasterDataStatus, SetupStepType } from '../../src/enums';
import { GradeRepository } from '../../src/modules/grade/repositories/grade.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { GradeEntity } from '../../src/modules/grade/entities/grade.entity';
import { CompanySetupStepEntity } from '../../src/modules/company/entities/company-setup-step.entity';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';

describe('GradeService - Create Grade [US1]', () => {
  let service: GradeService;
  let mockGradeRepo: jest.Mocked<Partial<GradeRepository>>;
  let mockCompanyRepo: jest.Mocked<Partial<CompanyRepository>>;
  let mockSetupStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;
  let mockDataSource: jest.Mocked<Partial<DataSource>>;
  let mockTxService: jest.Mocked<Partial<TransactionService>>;
  let mockOutboxRepo: jest.Mocked<Partial<Repository<OutboxEventEntity>>>;

  const mockAuthContext: AuthContext = {
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
      .mockReturnValue({ companyId: 'comp-1' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => dto as OutboxEventEntity),
      save: jest.fn().mockResolvedValue({ id: 'outbox-1' } as OutboxEventEntity),
    };

    mockGradeRepo = {
      findByCode: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      createAndSave: jest
        .fn()
        .mockImplementation((data) => ({ id: 'grade-1', ...data }) as GradeEntity),
    };

    mockCompanyRepo = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-1',
        timezone: 'UTC',
      } as CompanyEntity),
    };

    mockSetupStepRepo = {
      markStepCompleted: jest.fn().mockResolvedValue({} as CompanySetupStepEntity),
    };

    const mockManager: Partial<EntityManager> = {
      getRepository: jest
        .fn()
        .mockReturnValue(mockOutboxRepo as unknown as Repository<OutboxEventEntity>),
    };

    mockDataSource = {
      manager: mockManager as EntityManager,
    };

    mockTxService = {
      runInTransaction: jest.fn().mockImplementation(async (cb) => cb()),
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

  it('should reject if effectiveAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    await expect(
      service.create(
        {
          code: 'L3',
          name: 'Senior Software Engineer',
          effectiveAt: pastDate,
        },
        mockAuthContext,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject if grade code already exists in company', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    (mockGradeRepo.findByCode as jest.Mock).mockResolvedValue({
      id: 'existing-grade',
    } as GradeEntity);

    await expect(
      service.create(
        {
          code: 'L3',
          name: 'Senior Software Engineer',
          effectiveAt: futureDate,
        },
        mockAuthContext,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should successfully create grade in scheduled status and complete setup step 4', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();

    const result = await service.create(
      {
        code: 'L3',
        name: 'Senior Software Engineer',
        description: 'Level 3 contributor',
        rankOrder: 3,
        effectiveAt: futureDate,
      },
      mockAuthContext,
    );

    expect(result.id).toBe('grade-1');
    expect(result.code).toBe('L3');
    expect(result.status).toBe(MasterDataStatus.SCHEDULED);
    expect(mockSetupStepRepo.markStepCompleted).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      companyId: 'comp-1',
      stepType: SetupStepType.GRADE,
      completedBy: 'user-1',
      entityManager: mockDataSource.manager,
    });
    expect(mockOutboxRepo.save).toHaveBeenCalled();
  });
});
