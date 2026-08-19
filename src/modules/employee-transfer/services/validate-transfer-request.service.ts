import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CompanyStatus, MasterDataStatus } from '../../../enums';
import { CompanyRepository } from '../../company/repositories/company.repository';
import { DepartmentRepository } from '../../department/repositories/department.repository';
import { EmployeeReferenceRepository } from '../../employee-reference/repositories/employee-reference.repository';
import { GradeRepository } from '../../grade/repositories/grade.repository';
import { JobTitleRepository } from '../../job-title/repositories/job-title.repository';
import { LocationRepository } from '../../location/repositories/location.repository';
import { InitiateEmployeeTransferDto } from '../dtos/initiate-employee-transfer.dto';
import { EmployeeTransferRepository } from '../repositories/employee-transfer.repository';

export interface ValidatedTransferEntities {
  destinationCompanyId: string;
  sourceCompanyId: string;
  employeeId: string;
  effectiveAt: Date;
}

@Injectable()
export class ValidateTransferRequestService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly employeeReferenceRepository: EmployeeReferenceRepository,
    private readonly employeeTransferRepository: EmployeeTransferRepository,
    private readonly locationRepository: LocationRepository,
    private readonly departmentRepository: DepartmentRepository,
    private readonly gradeRepository: GradeRepository,
    private readonly jobTitleRepository: JobTitleRepository,
  ) {}

  async validate(
    tenantId: string,
    sourceCompanyId: string,
    employeeId: string,
    dto: InitiateEmployeeTransferDto,
    manager?: EntityManager,
  ): Promise<ValidatedTransferEntities> {
    // 1. Validate effective date (>= end of current business day in UTC)
    const effectiveDate = new Date(dto.effectiveAt);
    if (isNaN(effectiveDate.getTime())) {
      throw new BadRequestException('Invalid effective date format');
    }

    const now = new Date();
    const endOfCurrentBusinessDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
    );

    if (effectiveDate < endOfCurrentBusinessDay) {
      throw new BadRequestException(
        'Effective date must be greater than or equal to the end of the current business day',
      );
    }

    // 2. Validate destination company is not the same as source company
    if (dto.destinationCompanyId === sourceCompanyId) {
      throw new BadRequestException('Destination company must be different from source company');
    }

    // 3. Validate destination company exists in tenant and is ACTIVE
    const destinationCompany = await this.companyRepository.findByIdAndTenant(
      dto.destinationCompanyId,
      tenantId,
      manager,
    );

    if (!destinationCompany) {
      throw new NotFoundException('Destination company not found in tenant');
    }

    if (destinationCompany.status !== CompanyStatus.ACTIVE) {
      throw new BadRequestException(
        `Destination company is not in ACTIVE status (current status: ${destinationCompany.status})`,
      );
    }

    // 4. Validate employee exists in tenant and belongs to source company
    const employeeRef = await this.employeeReferenceRepository.findByEmployeeId(
      tenantId,
      employeeId,
      manager,
    );

    if (!employeeRef) {
      throw new NotFoundException('Employee not found in tenant');
    }

    if (employeeRef.companyId !== sourceCompanyId) {
      throw new BadRequestException('Employee does not belong to the specified source company');
    }

    // 5. Enforce single pending transfer per employee (INV-007, BR-33)
    const existingPending = await this.employeeTransferRepository.findPendingByEmployeeId(
      tenantId,
      employeeId,
      manager,
    );

    if (existingPending) {
      throw new ConflictException('Employee already has an active pending transfer');
    }

    // 6. Validate destination master data scoping and ACTIVE status (INV-005, INV-006)
    if (dto.destinationLocationId) {
      const location = await this.locationRepository.findById(
        tenantId,
        dto.destinationCompanyId,
        dto.destinationLocationId,
        manager,
      );
      if (!location) {
        throw new UnprocessableEntityException(
          'Destination location does not belong to destination company or does not exist',
        );
      }
      if (location.status !== MasterDataStatus.ACTIVE) {
        throw new UnprocessableEntityException('Destination location is not active');
      }
    }

    if (dto.destinationDepartmentId) {
      const department = await this.departmentRepository.findById(
        tenantId,
        dto.destinationCompanyId,
        dto.destinationDepartmentId,
        manager,
      );
      if (!department) {
        throw new UnprocessableEntityException(
          'Destination department does not belong to destination company or does not exist',
        );
      }
      if (department.status !== MasterDataStatus.ACTIVE) {
        throw new UnprocessableEntityException('Destination department is not active');
      }
    }

    if (dto.destinationGradeId) {
      const grade = await this.gradeRepository.findById(
        tenantId,
        dto.destinationCompanyId,
        dto.destinationGradeId,
        manager,
      );
      if (!grade) {
        throw new UnprocessableEntityException(
          'Destination grade does not belong to destination company or does not exist',
        );
      }
      if (grade.status !== MasterDataStatus.ACTIVE) {
        throw new UnprocessableEntityException('Destination grade is not active');
      }
    }

    if (dto.destinationJobTitleId) {
      const jobTitle = await this.jobTitleRepository.findById(
        tenantId,
        dto.destinationCompanyId,
        dto.destinationJobTitleId,
        manager,
      );
      if (!jobTitle) {
        throw new UnprocessableEntityException(
          'Destination job title does not belong to destination company or does not exist',
        );
      }
      if (jobTitle.status !== MasterDataStatus.ACTIVE) {
        throw new UnprocessableEntityException('Destination job title is not active');
      }
    }

    return {
      destinationCompanyId: dto.destinationCompanyId,
      sourceCompanyId,
      employeeId,
      effectiveAt: effectiveDate,
    };
  }
}
