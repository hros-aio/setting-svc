import { DepartmentService } from '../../src/modules/department/services/department.service';
import { MasterDataStatus } from '../../src/enums';
import { NotFoundException } from '@nestjs/common';
import { DepartmentRepository } from '../../src/modules/department/repositories/department.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { OutboxEventRepository } from '../../src/modules/company/repositories/outbox-event.repository';
import { TransactionService } from '@new-hros/libs-sql';
import { Department } from '@new-hros/libs-sql';
import { RequestContextService } from '@new-hros/libs-core';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';

describe('DepartmentService - Query Departments [US2]', () => {
  let service: DepartmentService;
  let mockDepartmentRepo: jest.Mocked<Partial<DepartmentRepository>>;

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-1');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-1',
      sessionId: 'sess-1',
      tenantCode: 'tenant-1',
      roles: ['admin'],
      scopes: [],
      permissions: ['department:read'],
    });
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
      {} as unknown as TransactionService,
      mockDepartmentRepo as unknown as DepartmentRepository,
      {} as unknown as CompanyRepository,
      {} as unknown as CompanySetupStepRepository,
      {} as unknown as EffectiveChangeRepository,
      {} as unknown as OutboxEventRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return paginated active departments for company', async () => {
    const mockResult = {
      data: [{ id: 'dept-1', name: 'Engineering', status: MasterDataStatus.ACTIVE } as Department],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    (mockDepartmentRepo.findActiveDepartments as jest.Mock).mockResolvedValue(mockResult);

    const result = await service.findActiveDepartments('comp-1', { page: 1, limit: 20 });
    expect(result).toBe(mockResult);
    expect(mockDepartmentRepo.findActiveDepartments).toHaveBeenCalledWith('comp-1', {
      page: 1,
      limit: 20,
    });
  });

  it('should return hierarchical department tree when asTree is true', async () => {
    const mockTree = [{ id: 'dept-1', name: 'HQ', children: [] }];
    (mockDepartmentRepo.findActiveDepartmentTree as jest.Mock).mockResolvedValue(mockTree);

    const result = await service.findActiveDepartments('comp-1', { asTree: true });
    expect(result).toBe(mockTree);
    expect(mockDepartmentRepo.findActiveDepartmentTree).toHaveBeenCalledWith('comp-1');
  });

  it('should return department by id', async () => {
    const mockDept = { id: 'dept-1', name: 'Engineering' } as Department;
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue(mockDept);

    const result = await service.findById('dept-1');
    expect(result).toBe(mockDept);
    expect(mockDepartmentRepo.findById).toHaveBeenCalledWith('dept-1');
  });

  it('should throw NotFoundException if department not found', async () => {
    (mockDepartmentRepo.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.findById('dept-999')).rejects.toThrow(NotFoundException);
  });
});
