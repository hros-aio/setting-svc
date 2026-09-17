import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RequestContextService } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import {
  ChangeOperation,
  EffectiveChangeStatus,
  MasterDataStatus,
  PocType,
  SetupStepType,
} from '../../src/enums';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
import { OutboxEventRepository } from '../../src/modules/company/repositories/outbox-event.repository';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { EffectiveChangeRepository } from '../../src/modules/effective-change/repositories/effective-change.repository';
import { EmployeeReferenceEntity } from '../../src/modules/employee-reference/entities/employee-reference.entity';
import { EmployeeReferenceRepository } from '../../src/modules/employee-reference/repositories/employee-reference.repository';
import { CreatePocDto } from '../../src/modules/poc/dtos/create-poc.dto';
import { DeactivatePocDto } from '../../src/modules/poc/dtos/deactivate-poc.dto';
import { ReplacePocDto } from '../../src/modules/poc/dtos/replace-poc.dto';
import { PocEntity } from '../../src/modules/poc/entities/poc.entity';
import { PocRepository } from '../../src/modules/poc/repositories/poc.repository';
import { PocService } from '../../src/modules/poc/services/poc.service';

describe('PocService', () => {
  let service: PocService;
  let mockTransactionService: jest.Mocked<TransactionService>;
  let mockPocRepo: jest.Mocked<PocRepository>;
  let mockEmployeeRefRepo: jest.Mocked<EmployeeReferenceRepository>;
  let mockCompanyRepo: jest.Mocked<CompanyRepository>;
  let mockCompanySetupStepRepo: jest.Mocked<CompanySetupStepRepository>;
  let mockEffectiveChangeRepo: jest.Mocked<EffectiveChangeRepository>;
  let mockOutboxRepo: jest.Mocked<OutboxEventRepository>;

  const futureEffectiveDate = new Date(Date.now() + 86400000 * 5).toISOString();

  beforeEach(() => {
    jest.spyOn(RequestContextService, 'getTenantCode').mockReturnValue('tenant-123');
    jest.spyOn(RequestContextService, 'getUser').mockReturnValue({
      userId: 'user-admin',
      employee: { companyId: 'company-123' },
    } as unknown as ReturnType<typeof RequestContextService.getUser>);
    jest
      .spyOn(RequestContextService, 'current')
      .mockReturnValue({ companyId: 'company-123' } as unknown as ReturnType<
        typeof RequestContextService.current
      >);

    mockOutboxRepo = {
      create: jest.fn().mockImplementation(async (dto) => ({ id: 'outbox-1', ...dto })),
    } as unknown as jest.Mocked<OutboxEventRepository>;

    mockTransactionService = {
      runInTransaction: jest.fn().mockImplementation(async (cb: () => Promise<unknown>) => cb()),
    } as unknown as jest.Mocked<TransactionService>;

    mockPocRepo = {
      findById: jest.fn(),
      findByCompanyAndType: jest.fn(),
      findActiveByCompany: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<PocRepository>;

    mockEmployeeRefRepo = {
      findByEmployeeId: jest.fn(),
      findByCompanyAndEmployeeId: jest.fn(),
      findByEmployeeIds: jest.fn(),
    } as unknown as jest.Mocked<EmployeeReferenceRepository>;

    mockCompanyRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<CompanyRepository>;

    mockCompanySetupStepRepo = {
      markStepCompleted: jest.fn(),
    } as unknown as jest.Mocked<CompanySetupStepRepository>;

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<EffectiveChangeRepository>;

    service = new PocService(
      mockTransactionService,
      mockOutboxRepo,
      mockPocRepo,
      mockEmployeeRefRepo,
      mockCompanyRepo,
      mockCompanySetupStepRepo,
      mockEffectiveChangeRepo,
    );

    mockCompanyRepo.findById.mockResolvedValue({
      id: 'company-123',
      tenantCode: 'tenant-123',
      timezone: 'UTC',
    } as unknown as CompanyEntity);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    const createDto: CreatePocDto = {
      pocType: PocType.HR_HEAD,
      employeeId: '550e8400-e29b-41d4-a716-446655440000',
      effectiveAt: futureEffectiveDate,
    };

    it('should successfully create scheduled PoC, complete Step 8, and emit outbox event', async () => {
      mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue({
        id: 'ref-1',
        employeeId: createDto.employeeId,
        employmentStatus: 'ACTIVE',
      } as EmployeeReferenceEntity);

      mockPocRepo.findByCompanyAndType.mockResolvedValue(null);

      const createdPoc = {
        id: 'poc-1',
        tenantCode: 'tenant-123',
        companyId: 'company-123',
        pocType: PocType.HR_HEAD,
        employeeId: createDto.employeeId,
        status: MasterDataStatus.SCHEDULED,
        effectiveAt: new Date(createDto.effectiveAt),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as PocEntity;

      mockPocRepo.create.mockResolvedValue(createdPoc);

      const result = await service.create('company-123', createDto);

      expect(mockPocRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantCode: 'tenant-123',
          companyId: 'company-123',
          pocType: PocType.HR_HEAD,
          status: MasterDataStatus.SCHEDULED,
        }),
      );

      expect(mockCompanySetupStepRepo.markStepCompleted).toHaveBeenCalledWith({
        companyId: 'company-123',
        stepType: SetupStepType.POC,
        completedBy: 'user-admin',
      });

      expect(mockOutboxRepo.create).toHaveBeenCalled();
      expect(result).toEqual(createdPoc);
    });

    it('should reject if referenced employee is not found', async () => {
      mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue(null);

      await expect(service.create('company-123', createDto)).rejects.toThrow(NotFoundException);
    });

    it('should reject if referenced employee is terminated', async () => {
      mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue({
        id: 'ref-1',
        employeeId: createDto.employeeId,
        employmentStatus: 'TERMINATED',
      } as EmployeeReferenceEntity);

      await expect(service.create('company-123', createDto)).rejects.toThrow(BadRequestException);
    });

    it('should reject if active or scheduled PoC of same type already exists', async () => {
      mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue({
        id: 'ref-1',
        employeeId: createDto.employeeId,
        employmentStatus: 'ACTIVE',
      } as EmployeeReferenceEntity);

      mockPocRepo.findByCompanyAndType.mockResolvedValue({
        id: 'existing-poc',
        status: MasterDataStatus.ACTIVE,
      } as unknown as PocEntity);

      await expect(service.create('company-123', createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('replace', () => {
    const replaceDto: ReplacePocDto = {
      newEmployeeId: '660e8400-e29b-41d4-a716-446655440111',
      effectiveAt: futureEffectiveDate,
      reason: 'Role succession',
    };

    it('should schedule replacement change when target PoC is active and no pending change exists', async () => {
      mockPocRepo.findById.mockResolvedValue({
        id: 'poc-1',
        tenantCode: 'tenant-123',
        companyId: 'company-123',
        pocType: PocType.FINANCE_HEAD,
        status: MasterDataStatus.ACTIVE,
        updatedAt: new Date(),
      } as unknown as PocEntity);

      mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue({
        id: 'ref-2',
        employeeId: replaceDto.newEmployeeId,
        employmentStatus: 'ACTIVE',
      } as EmployeeReferenceEntity);

      mockEffectiveChangeRepo.findPendingChange.mockResolvedValue(null);

      const savedChange = {
        id: 'change-1',
        tenantCode: 'tenant-123',
        companyId: 'company-123',
        entityType: 'poc',
        entityId: 'poc-1',
        operation: ChangeOperation.UPDATE,
        status: EffectiveChangeStatus.SCHEDULED,
      } as unknown as EffectiveChangeEntity;

      mockEffectiveChangeRepo.create.mockResolvedValue(savedChange);

      const result = await service.replace('company-123', 'poc-1', replaceDto);

      expect(mockEffectiveChangeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'poc',
          entityId: 'poc-1',
          operation: ChangeOperation.UPDATE,
          status: EffectiveChangeStatus.SCHEDULED,
        }),
      );
      expect(result).toEqual(savedChange);
    });

    it('should reject if target PoC already has a pending scheduled change', async () => {
      mockPocRepo.findById.mockResolvedValue({
        id: 'poc-1',
        tenantCode: 'tenant-123',
        companyId: 'company-123',
        pocType: PocType.FINANCE_HEAD,
        status: MasterDataStatus.ACTIVE,
      } as unknown as PocEntity);

      mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue({
        id: 'ref-2',
        employeeId: replaceDto.newEmployeeId,
        employmentStatus: 'ACTIVE',
      } as EmployeeReferenceEntity);

      mockEffectiveChangeRepo.findPendingChange.mockResolvedValue({
        id: 'existing-pending-change',
      } as EffectiveChangeEntity);

      await expect(service.replace('company-123', 'poc-1', replaceDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('deactivate', () => {
    const deactivateDto: DeactivatePocDto = {
      effectiveAt: futureEffectiveDate,
      reason: 'Phased out',
    };

    it('should schedule deactivation for active PoC without pending changes', async () => {
      mockPocRepo.findById.mockResolvedValue({
        id: 'poc-1',
        tenantCode: 'tenant-123',
        companyId: 'company-123',
        pocType: PocType.IT_HEAD,
        status: MasterDataStatus.ACTIVE,
      } as unknown as PocEntity);

      mockEffectiveChangeRepo.findPendingChange.mockResolvedValue(null);

      const savedChange = {
        id: 'change-deact',
        operation: ChangeOperation.DEACTIVATE,
        status: EffectiveChangeStatus.SCHEDULED,
      } as unknown as EffectiveChangeEntity;

      mockEffectiveChangeRepo.create.mockResolvedValue(savedChange);

      const result = await service.deactivate('company-123', 'poc-1', deactivateDto);

      expect(mockEffectiveChangeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: ChangeOperation.DEACTIVATE,
        }),
      );
      expect(result).toEqual(savedChange);
    });
  });
});
