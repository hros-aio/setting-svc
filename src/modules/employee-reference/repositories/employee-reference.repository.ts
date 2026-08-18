import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { EmployeeReferenceEntity } from '../entities/employee-reference.entity';
import { IEmployeeReferenceRepository } from './employee-reference.repository.interface';

@Injectable()
export class EmployeeReferenceRepository implements IEmployeeReferenceRepository {
  constructor(
    @InjectRepository(EmployeeReferenceEntity)
    private readonly repo: Repository<EmployeeReferenceEntity>,
  ) {}

  private getRepo(manager?: EntityManager): Repository<EmployeeReferenceEntity> {
    return manager ? manager.getRepository(EmployeeReferenceEntity) : this.repo;
  }

  async findByEmployeeId(
    tenantId: string,
    employeeId: string,
    manager?: EntityManager,
  ): Promise<EmployeeReferenceEntity | null> {
    return this.getRepo(manager).findOne({
      where: {
        tenantId,
        employeeId,
      },
    });
  }

  async findByCompanyAndEmployeeId(
    tenantId: string,
    companyId: string,
    employeeId: string,
    manager?: EntityManager,
  ): Promise<EmployeeReferenceEntity | null> {
    return this.getRepo(manager).findOne({
      where: {
        tenantId,
        companyId,
        employeeId,
      },
    });
  }

  async findByEmployeeIds(
    tenantId: string,
    employeeIds: string[],
    manager?: EntityManager,
  ): Promise<EmployeeReferenceEntity[]> {
    if (!employeeIds.length) {
      return [];
    }
    return this.getRepo(manager).find({
      where: {
        tenantId,
        employeeId: In(employeeIds),
      },
    });
  }
}
