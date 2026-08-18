import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuthContext } from '@new-hros/libs-core';
import { TransactionService } from '@new-hros/libs-sql';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  ChangeOperation,
  EffectiveChangeStatus,
  MasterDataStatus,
  PocType,
  SetupStepType,
} from '../../src/enums';
import { CompanyEntity } from '../../src/modules/company/entities/company.entity';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { CompanySetupStepRepository } from '../../src/modules/company/repositories/company-setup-step.repository';
import { CompanyRepository } from '../../src/modules/company/repositories/company.repository';
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
  let mockDataSource: jest.Mocked<DataSource>;
  let mockTransactionService: jest.Mocked<TransactionService>;
  let mockPocRepo: jest.Mocked<PocRepository>;
  let mockEmployeeRefRepo: jest.Mocked<EmployeeReferenceRepository>;
  let mockCompanyRepo: jest.Mocked<CompanyRepository>;
  let mockCompanySetupStepRepo: jest.Mocked<CompanySetupStepRepository>;
  let mockEffectiveChangeRepo: jest.Mocked<EffectiveChangeRepository>;
  let mockEntityManager: jest.Mocked<EntityManager>;
  let mockOutboxRepo: jest.Mocked<Repository<OutboxEventEntity>>;

  const authContext: AuthContext = {
    tenantCode: 'tenant-123',
    userId: 'user-admin',
    roles: ['Administrator'],
    sessionId: 'session-123',
    scopes: [],
    permissions: ['poc:create', 'poc:update', 'poc:deactivate', 'poc:read'],
  };

  const futureEffectiveDate = new Date(Date.now() + 86400000 * 5).toISOString();

  beforeEach(() => {
    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto: unknown) => dto),
      save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
    } as unknown as jest.Mocked<Repository<OutboxEventEntity>>;

    mockEntityManager = {
      getRepository: jest.fn().mockReturnValue(mockOutboxRepo),
    } as unknown as jest.Mocked<EntityManager>;

    mockDataSource = {
      manager: mockEntityManager,
    } as unknown as jest.Mocked<DataSource>;

    mockTransactionService = {
      runInTransaction: jest.fn().mockImplementation(async (cb: () => Promise<unknown>) => cb()),
    } as unknown as jest.Mocked<TransactionService>;

    mockPocRepo = {
      findById: jest.fn(),
      findByCompanyAndType: jest.fn(),
      findActiveByCompany: jest.fn(),
      createAndSave: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<PocRepository>;

    mockEmployeeRefRepo = {
      findByEmployeeId: jest.fn(),
      findByCompanyAndEmployeeId: jest.fn(),
      findByEmployeeIds: jest.fn(),
    } as unknown as jest.Mocked<EmployeeReferenceRepository>;

    mockCompanyRepo = {
      findByIdAndTenant: jest.fn(),
    } as unknown as jest.Mocked<CompanyRepository>;

    mockCompanySetupStepRepo = {
      markStepCompleted: jest.fn(),
    } as unknown as jest.Mocked<CompanySetupStepRepository>;

    mockEffectiveChangeRepo = {
      findPendingChange: jest.fn(),
      createAndSave: jest.fn(),
    } as unknown as jest.Mocked<EffectiveChangeRepository>;

    service = new PocService(
      mockDataSource,
      mockTransactionService,
      mockPocRepo,
      mockEmployeeRefRepo,
      mockCompanyRepo,
      mockCompanySetupStepRepo,
      mockEffectiveChangeRepo,
    );

    mockCompanyRepo.findByIdAndTenant.mockResolvedValue({
      id: 'company-123',
      tenantId: 'tenant-123',
      timezone: 'UTC',
    } as CompanyEntity);
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

      const createdPoc: PocEntity = {
        id: 'poc-1',
        tenantId: 'tenant-123',
        companyId: 'company-123',
        pocType: PocType.HR_HEAD,
        employeeId: createDto.employeeId,
        status: MasterDataStatus.SCHEDULED,
        effectiveAt: new Date(createDto.effectiveAt),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PocEntity;

      mockPocRepo.createAndSave.mockResolvedValue(createdPoc);

      const result = await service.create('company-123', createDto, authContext);

      expect(mockPocRepo.createAndSave).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          companyId: 'company-123',
          pocType: PocType.HR_HEAD,
          status: MasterDataStatus.SCHEDULED,
        }),
        mockEntityManager,
      );

      expect(mockCompanySetupStepRepo.markStepCompleted).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        companyId: 'company-123',
        stepType: SetupStepType.POC,
        completedBy: 'user-admin',
        entityManager: mockEntityManager,
      });

      expect(mockOutboxRepo.save).toHaveBeenCalled();
      expect(result).toEqual(createdPoc);
    });

    it('should reject if referenced employee is not found', async () => {
      mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue(null);

      await expect(service.create('company-123', createDto, authContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject if referenced employee is terminated', async () => {
      mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue({
        id: 'ref-1',
        employeeId: createDto.employeeId,
        employmentStatus: 'TERMINATED',
      } as EmployeeReferenceEntity);

      await expect(service.create('company-123', createDto, authContext)).rejects.toThrow(
        BadRequestException,
      );
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
      } as PocEntity);

      await expect(service.create('company-123', createDto, authContext)).rejects.toThrow(
        ConflictException,
      );
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
        tenantId: 'tenant-123',
        companyId: 'company-123',
        pocType: PocType.FINANCE_HEAD,
        status: MasterDataStatus.ACTIVE,
        updatedAt: new Date(),
      } as PocEntity);

      mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue({
        id: 'ref-2',
        employeeId: replaceDto.newEmployeeId,
        employmentStatus: 'ACTIVE',
      } as EmployeeReferenceEntity);

      mockEffectiveChangeRepo.findPendingChange.mockResolvedValue(null);

      const savedChange = {
        id: 'change-1',
        tenantId: 'tenant-123',
        companyId: 'company-123',
        entityType: 'poc',
        entityId: 'poc-1',
        operation: ChangeOperation.UPDATE,
        status: EffectiveChangeStatus.SCHEDULED,
      } as EffectiveChangeEntity;

      mockEffectiveChangeRepo.createAndSave.mockResolvedValue(savedChange);

      const result = await service.replace('company-123', 'poc-1', replaceDto, authContext);

      expect(mockEffectiveChangeRepo.createAndSave).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'poc',
          entityId: 'poc-1',
          operation: ChangeOperation.UPDATE,
          status: EffectiveChangeStatus.SCHEDULED,
        }),
        mockEntityManager,
      );
      expect(result).toEqual(savedChange);
    });

    it('should reject if target PoC already has a pending scheduled change', async () => {
      mockPocRepo.findById.mockResolvedValue({
        id: 'poc-1',
        tenantId: 'tenant-123',
        companyId: 'company-123',
        pocType: PocType.FINANCE_HEAD,
        status: MasterDataStatus.ACTIVE,
      } as PocEntity);

      mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue({
        id: 'ref-2',
        employeeId: replaceDto.newEmployeeId,
        employmentStatus: 'ACTIVE',
      } as EmployeeReferenceEntity);

      mockEffectiveChangeRepo.findPendingChange.mockResolvedValue({
        id: 'existing-pending-change',
      } as EffectiveChangeEntity);

      await expect(
        service.replace('company-123', 'poc-1', replaceDto, authContext),
      ).rejects.toThrow(ConflictException);
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
        tenantId: 'tenant-123',
        companyId: 'company-123',
        pocType: PocType.IT_HEAD,
        status: MasterDataStatus.ACTIVE,
      } as PocEntity);

      mockEffectiveChangeRepo.findPendingChange.mockResolvedValue(null);

      const savedChange = {
        id: 'change-deact',
        operation: ChangeOperation.DEACTIVATE,
        status: EffectiveChangeStatus.SCHEDULED,
      } as EffectiveChangeEntity;

      mockEffectiveChangeRepo.createAndSave.mockResolvedValue(savedChange);

      const result = await service.deactivate('company-123', 'poc-1', deactivateDto, authContext);

      expect(mockEffectiveChangeRepo.createAndSave).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: ChangeOperation.DEACTIVATE,
        }),
        mockEntityManager,
      );
      expect(result).toEqual(savedChange);
    });
  });
});
