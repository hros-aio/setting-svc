import { DepartmentService } from '../../src/modules/department/services/department.service';
import { MasterDataStatus } from '../../src/enums';
import { Logger, NotFoundException } from '@nestjs/common';
import { DepartmentRepository } from '../../src/modules/department/repositories/department.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { DataSource } from 'typeorm';
import { TransactionService } from '@new-hros/libs-sql';
import { DepartmentEntity } from '../../src/modules/department/entities/department.entity';
import { AuthContext, RequestContextService } from '@new-hros/libs-core';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';

describe('DepartmentService - Query Departments [US2]', () => {
  let service: DepartmentService;
  let mockDepartmentRepo: jest.Mocked<Partial<DepartmentRepository>>;

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    sessionId: 'sess-1',
    tenantCode: 'tenant-1',
    roles: ['admin'],
    scopes: [],
    permissions: ['department:read'],
  };

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'comp-1' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockDepartmentRepo = {
      findActiveDepartments: jest.fn(),
      findActiveDepartmentTree: jest.fn(),
      findById: jest.fn(),
    };

    service = new DepartmentService(
      {} as unknown as DataSource,
      {} as unknown as TransactionService,
      mockDepartmentRepo as unknown as DepartmentRepository,
      {} as unknown as CompanyRepository,
      {} as unknown as CompanySetupStepRepository,
      {} as unknown as EffectiveChangeRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return paginated active departments for company', async () => {
    const mockResult = {
      data: [
        { id: 'dept-1', name: 'Engineering', status: MasterDataStatus.ACTIVE } as DepartmentEntity,
      ],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    (mockDepartmentRepo.findActiveDepartments as jest.Mock).mockResolvedValue(mockResult);

    const result = await service.findActiveDepartments({ page: 1, limit: 20 }, mockAuthContext);
    expect(result).toBe(mockResult);
    expect(mockDepartmentRepo.findActiveDepartments).toHaveBeenCalledWith('tenant-1', 'comp-1', {
      page: 1,
      limit: 20,
      search: undefined,
    });
  });

  it('should return hierarchical department tree when asTree is true', async () => {
    const mockTree = [{ id: 'dept-1', name: 'HQ', children: [] }];
    (mockDepartmentRepo.findActiveDepartmentTree as jest.Mock).mockResolvedValue(mockTree);

    const result = await service.findActiveDepartments({ asTree: true }, mockAuthContext);
    expect(result).toBe(mockTree);
    expect(mockDepartmentRepo.findActiveDepartmentTree).toHaveBeenCalledWith('tenant-1', 'comp-1');
  });

  it('should return empty result and log warning if tenantId is missing', async () => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue(null);
    const warnSpy = jest
      .spyOn((service as unknown as { logger: Logger }).logger, 'warn')
      .mockImplementation();

    const result = await service.findActiveDepartments({ page: 1, limit: 10 }, null);

    expect(result).toEqual({
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('missing tenantId from request context'),
    );
    expect(mockDepartmentRepo.findActiveDepartments).not.toHaveBeenCalled();
  });

  it('should return department by id', async () => {
    const mockDept = { id: 'dept-1', name: 'Engineering' } as DepartmentEntity;
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue(mockDept);

    const result = await service.findById('dept-1', mockAuthContext);
    expect(result).toBe(mockDept);
  });

  it('should throw NotFoundException if department not found', async () => {
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.findById('dept-999', mockAuthContext)).rejects.toThrow(NotFoundException);
  });
});
