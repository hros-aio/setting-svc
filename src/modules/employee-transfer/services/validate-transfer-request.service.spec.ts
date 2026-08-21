import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CompanyStatus, MasterDataStatus } from '../../../enums';
import { CompanyEntity } from '../../company/entities/company.entity';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { Department } from '@new-hros/libs-sql';
import { DepartmentRepository } from '../../department/repositories/department.repository';
import { EmployeeReferenceEntity } from '../../employee-reference/entities/employee-reference.entity';
import { EmployeeReferenceRepository } from '../../employee-reference/repositories/employee-reference.repository';
import { Grade } from '@new-hros/libs-sql';
import { GradeRepository } from '../../grade/repositories/grade.repository';
import { JobTitle } from '@new-hros/libs-sql';
import { JobTitleRepository } from '../../job-title/repositories/job-title.repository';
import { Location } from '@new-hros/libs-sql';
import { LocationRepository } from '../../location/repositories/location.repository';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import { EmployeeTransferRepository } from '../repositories/employee-transfer.repository';
import { ValidateTransferRequestService } from './validate-transfer-request.service';

describe('ValidateTransferRequestService', () => {
  let service: ValidateTransferRequestService;
  let mockCompanyRepo: jest.Mocked<CompanyRepository>;
  let mockEmployeeRefRepo: jest.Mocked<EmployeeReferenceRepository>;
  let mockTransferRepo: jest.Mocked<EmployeeTransferRepository>;
  let mockLocationRepo: jest.Mocked<LocationRepository>;
  let mockDeptRepo: jest.Mocked<DepartmentRepository>;
  let mockGradeRepo: jest.Mocked<GradeRepository>;
  let mockJobTitleRepo: jest.Mocked<JobTitleRepository>;

  const futureDate = new Date(Date.now() + 86400000 * 7).toISOString();

  beforeEach(() => {
    mockCompanyRepo = {
      findByIdAndTenant: jest.fn(),
    } as unknown as jest.Mocked<CompanyRepository>;

    mockEmployeeRefRepo = {
      findByEmployeeId: jest.fn(),
    } as unknown as jest.Mocked<EmployeeReferenceRepository>;

    mockTransferRepo = {
      findPendingByEmployeeId: jest.fn(),
    } as unknown as jest.Mocked<EmployeeTransferRepository>;

    mockLocationRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<LocationRepository>;

    mockDeptRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<DepartmentRepository>;

    mockGradeRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<GradeRepository>;

    mockJobTitleRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<JobTitleRepository>;

    service = new ValidateTransferRequestService(
      mockCompanyRepo,
      mockEmployeeRefRepo,
      mockTransferRepo,
      mockLocationRepo,
      mockDeptRepo,
      mockGradeRepo,
      mockJobTitleRepo,
    );
  });

  it('should throw BadRequestException if effectiveAt is in the past or today', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    await expect(
      service.validate('tenant-1', 'comp-1', 'emp-1', {
        companyId: 'comp-1',
        employeeId: 'emp-1',
        destinationCompanyId: 'comp-2',
        effectiveAt: pastDate,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if destination company equals source company', async () => {
    await expect(
      service.validate('tenant-1', 'comp-1', 'emp-1', {
        companyId: 'comp-1',
        employeeId: 'emp-1',
        destinationCompanyId: 'comp-1',
        effectiveAt: futureDate,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if destination company does not exist in tenant', async () => {
    mockCompanyRepo.findByIdAndTenant.mockResolvedValue(null);

    await expect(
      service.validate('tenant-1', 'comp-1', 'emp-1', {
        companyId: 'comp-1',
        employeeId: 'emp-1',
        destinationCompanyId: 'comp-2',
        effectiveAt: futureDate,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if destination company is not ACTIVE', async () => {
    mockCompanyRepo.findByIdAndTenant.mockResolvedValue({
      id: 'comp-2',
      tenantId: 'tenant-1',
      status: CompanyStatus.PENDING,
    } as unknown as CompanyEntity);

    await expect(
      service.validate('tenant-1', 'comp-1', 'emp-1', {
        companyId: 'comp-1',
        employeeId: 'emp-1',
        destinationCompanyId: 'comp-2',
        effectiveAt: futureDate,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if employee reference not found', async () => {
    mockCompanyRepo.findByIdAndTenant.mockResolvedValue({
      id: 'comp-2',
      tenantId: 'tenant-1',
      status: CompanyStatus.ACTIVE,
    } as unknown as CompanyEntity);
    mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue(null);

    await expect(
      service.validate('tenant-1', 'comp-1', 'emp-1', {
        companyId: 'comp-1',
        employeeId: 'emp-1',
        destinationCompanyId: 'comp-2',
        effectiveAt: futureDate,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if employee belongs to another company', async () => {
    mockCompanyRepo.findByIdAndTenant.mockResolvedValue({
      id: 'comp-2',
      tenantId: 'tenant-1',
      status: CompanyStatus.ACTIVE,
    } as unknown as CompanyEntity);
    mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue({
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      companyId: 'comp-other',
    } as unknown as EmployeeReferenceEntity);

    await expect(
      service.validate('tenant-1', 'comp-1', 'emp-1', {
        companyId: 'comp-1',
        employeeId: 'emp-1',
        destinationCompanyId: 'comp-2',
        effectiveAt: futureDate,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw ConflictException if an active pending transfer already exists', async () => {
    mockCompanyRepo.findByIdAndTenant.mockResolvedValue({
      id: 'comp-2',
      tenantId: 'tenant-1',
      status: CompanyStatus.ACTIVE,
    } as unknown as CompanyEntity);
    mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue({
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      companyId: 'comp-1',
    } as unknown as EmployeeReferenceEntity);
    mockTransferRepo.findPendingByEmployeeId.mockResolvedValue({
      id: 'trans-existing',
    } as EmployeeTransferEntity);

    await expect(
      service.validate('tenant-1', 'comp-1', 'emp-1', {
        companyId: 'comp-1',
        employeeId: 'emp-1',
        destinationCompanyId: 'comp-2',
        effectiveAt: futureDate,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw UnprocessableEntityException if destination location is not active', async () => {
    mockCompanyRepo.findByIdAndTenant.mockResolvedValue({
      id: 'comp-2',
      tenantId: 'tenant-1',
      status: CompanyStatus.ACTIVE,
    } as unknown as CompanyEntity);
    mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue({
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      companyId: 'comp-1',
    } as unknown as EmployeeReferenceEntity);
    mockTransferRepo.findPendingByEmployeeId.mockResolvedValue(null);
    mockLocationRepo.findById.mockResolvedValue({
      id: 'loc-1',
      status: MasterDataStatus.INACTIVE,
    } as unknown as Location);

    await expect(
      service.validate('tenant-1', 'comp-1', 'emp-1', {
        companyId: 'comp-1',
        employeeId: 'emp-1',
        destinationCompanyId: 'comp-2',
        destinationLocationId: 'loc-1',
        effectiveAt: futureDate,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('should return validated entities for a valid transfer request', async () => {
    mockCompanyRepo.findByIdAndTenant.mockResolvedValue({
      id: 'comp-2',
      tenantId: 'tenant-1',
      status: CompanyStatus.ACTIVE,
    } as unknown as CompanyEntity);
    mockEmployeeRefRepo.findByEmployeeId.mockResolvedValue({
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      companyId: 'comp-1',
    } as unknown as EmployeeReferenceEntity);
    mockTransferRepo.findPendingByEmployeeId.mockResolvedValue(null);
    mockLocationRepo.findById.mockResolvedValue({
      id: 'loc-1',
      status: MasterDataStatus.ACTIVE,
    } as unknown as Location);
    mockDeptRepo.findById.mockResolvedValue({
      id: 'dept-1',
      status: MasterDataStatus.ACTIVE,
    } as unknown as Department);
    mockGradeRepo.findById.mockResolvedValue({
      id: 'grade-1',
      status: MasterDataStatus.ACTIVE,
    } as unknown as Grade);
    mockJobTitleRepo.findById.mockResolvedValue({
      id: 'job-1',
      status: MasterDataStatus.ACTIVE,
    } as unknown as JobTitle);

    const result = await service.validate('tenant-1', 'comp-1', 'emp-1', {
      companyId: 'comp-1',
      employeeId: 'emp-1',
      destinationCompanyId: 'comp-2',
      destinationLocationId: 'loc-1',
      destinationDepartmentId: 'dept-1',
      destinationGradeId: 'grade-1',
      destinationJobTitleId: 'job-1',
      effectiveAt: futureDate,
    });

    expect(result.destinationCompanyId).toBe('comp-2');
    expect(result.sourceCompanyId).toBe('comp-1');
    expect(result.employeeId).toBe('emp-1');
    expect(result.effectiveAt).toBeDefined();
  });
});
