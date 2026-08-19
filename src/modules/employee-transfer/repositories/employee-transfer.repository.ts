import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EmployeeTransferStatus } from '../../../enums';
import { EmployeeTransferEntity } from '../entities/employee-transfer.entity';
import {
  EmployeeTransferPaginatedResult,
  EmployeeTransferPaginationOptions,
  IEmployeeTransferRepository,
} from './employee-transfer.repository.interface';

@Injectable()
export class EmployeeTransferRepository implements IEmployeeTransferRepository {
  constructor(
    @InjectRepository(EmployeeTransferEntity)
    private readonly repo: Repository<EmployeeTransferEntity>,
  ) {}

  private getRepo(manager?: EntityManager): Repository<EmployeeTransferEntity> {
    return manager ? manager.getRepository(EmployeeTransferEntity) : this.repo;
  }

  async findById(
    tenantId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<EmployeeTransferEntity | null> {
    return this.getRepo(manager).findOne({
      where: {
        id,
        tenantId,
      },
      relations: [
        'sourceCompany',
        'destinationCompany',
        'destinationLocation',
        'destinationDepartment',
        'destinationGrade',
        'destinationJobTitle',
      ],
    });
  }

  async findPendingByEmployeeId(
    tenantId: string,
    employeeId: string,
    manager?: EntityManager,
  ): Promise<EmployeeTransferEntity | null> {
    return this.getRepo(manager).findOne({
      where: {
        tenantId,
        employeeId,
        status: EmployeeTransferStatus.PENDING,
      },
      relations: [
        'sourceCompany',
        'destinationCompany',
        'destinationLocation',
        'destinationDepartment',
        'destinationGrade',
        'destinationJobTitle',
      ],
    });
  }

  async findHistoryByEmployeeId(
    tenantId: string,
    employeeId: string,
    options?: EmployeeTransferPaginationOptions,
    manager?: EntityManager,
  ): Promise<EmployeeTransferPaginatedResult<EmployeeTransferEntity>> {
    const limit = Math.max(1, Math.min(options?.limit ?? 20, 100));
    const offset = Math.max(0, options?.offset ?? 0);

    const [items, total] = await this.getRepo(manager).findAndCount({
      where: {
        tenantId,
        employeeId,
      },
      relations: [
        'sourceCompany',
        'destinationCompany',
        'destinationLocation',
        'destinationDepartment',
        'destinationGrade',
        'destinationJobTitle',
      ],
      order: {
        createdAt: 'DESC',
      },
      take: limit,
      skip: offset,
    });

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  async createAndSave(
    data: Partial<EmployeeTransferEntity>,
    manager?: EntityManager,
  ): Promise<EmployeeTransferEntity> {
    const repo = this.getRepo(manager);
    const entity = repo.create(data);
    return repo.save(entity);
  }

  async save(
    entity: EmployeeTransferEntity,
    manager?: EntityManager,
  ): Promise<EmployeeTransferEntity> {
    return this.getRepo(manager).save(entity);
  }
}
