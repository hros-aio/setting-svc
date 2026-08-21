import { GradeApplyHandler } from '../../src/modules/effective-change/handlers/grade-apply.handler';
import { Grade } from '@new-hros/libs-sql';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { EffectiveChangeStatus, GradeEventType, MasterDataStatus } from '../../src/enums';
import { DataSource, EntityManager, Repository } from 'typeorm';

describe('GradeApplyHandler [US5]', () => {
  let handler: GradeApplyHandler;
  let mockGradeRepo: jest.Mocked<Partial<Repository<Grade>>>;
  let mockChangeRepo: jest.Mocked<Partial<Repository<EffectiveChangeEntity>>>;
  let mockOutboxRepo: jest.Mocked<Partial<Repository<OutboxEventEntity>>>;
  let mockEntityManager: jest.Mocked<Partial<EntityManager>>;

  beforeEach(() => {
    mockGradeRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    mockChangeRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((dto) => dto as OutboxEventEntity),
      save: jest.fn().mockResolvedValue({ id: 'outbox-1' } as OutboxEventEntity),
    };

    mockEntityManager = {
      getRepository: jest.fn().mockImplementation((entityClass) => {
        if (entityClass === Grade) return mockGradeRepo;
        if (entityClass === EffectiveChangeEntity) return mockChangeRepo;
        if (entityClass === OutboxEventEntity) return mockOutboxRepo;
        return null;
      }),
    };

    handler = new GradeApplyHandler({
      manager: mockEntityManager as unknown as EntityManager,
    } as unknown as DataSource);
  });

  describe('apply CREATE', () => {
    it('should transition grade from scheduled to active and emit grade.created event', async () => {
      const mockGrade = {
        id: 'grade-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        code: 'L3',
        name: 'Senior Software Engineer',
        status: MasterDataStatus.SCHEDULED,
        effectiveAt: new Date('2026-08-20T00:00:00.000Z'),
      } as Grade;

      (mockGradeRepo.findOne as jest.Mock).mockResolvedValue(mockGrade);

      await handler.apply(
        {
          changeId: 'grade-1',
          entityType: 'grade',
          operation: 'CREATE',
          tenantId: 'tenant-1',
          companyId: 'comp-1',
        },
        mockEntityManager as unknown as EntityManager,
      );

      expect(mockGrade.status).toBe(MasterDataStatus.ACTIVE);
      expect(mockGradeRepo.save).toHaveBeenCalledWith(mockGrade);
      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: GradeEventType.GRADE_CREATED,
        }),
      );
      expect(mockOutboxRepo.save).toHaveBeenCalled();
    });

    it('should idempotent skip if grade is already active', async () => {
      const mockGrade = {
        id: 'grade-1',
        status: MasterDataStatus.ACTIVE,
      } as Grade;

      (mockGradeRepo.findOne as jest.Mock).mockResolvedValue(mockGrade);

      await handler.apply(
        {
          changeId: 'grade-1',
          entityType: 'grade',
          operation: 'CREATE',
          tenantId: 'tenant-1',
          companyId: 'comp-1',
        },
        mockEntityManager as unknown as EntityManager,
      );

      expect(mockGradeRepo.save).not.toHaveBeenCalled();
      expect(mockOutboxRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('apply UPDATE', () => {
    it('should apply payload fields to grade, mark change applied, and emit grade.updated event', async () => {
      const mockChange = {
        id: 'change-1',
        entityId: 'grade-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        status: EffectiveChangeStatus.SCHEDULED,
        payload: {
          name: 'Lead Senior Software Engineer',
          rankOrder: 4,
        },
      } as unknown as EffectiveChangeEntity;

      const mockGrade = {
        id: 'grade-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        name: 'Senior Software Engineer',
        rankOrder: 3,
        status: MasterDataStatus.ACTIVE,
      } as Grade;

      (mockChangeRepo.findOne as jest.Mock).mockResolvedValue(mockChange);
      (mockGradeRepo.findOne as jest.Mock).mockResolvedValue(mockGrade);

      await handler.apply(
        {
          changeId: 'change-1',
          entityType: 'grade',
          operation: 'UPDATE',
          tenantId: 'tenant-1',
          companyId: 'comp-1',
        },
        mockEntityManager as unknown as EntityManager,
      );

      expect(mockGrade.name).toBe('Lead Senior Software Engineer');
      expect(mockGrade.rankOrder).toBe(4);
      expect(mockGradeRepo.save).toHaveBeenCalledWith(mockGrade);
      expect(mockChange.status).toBe(EffectiveChangeStatus.APPLIED);
      expect(mockChangeRepo.save).toHaveBeenCalledWith(mockChange);
      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: GradeEventType.GRADE_UPDATED,
        }),
      );
    });
  });

  describe('apply DEACTIVATE', () => {
    it('should set grade to inactive, mark change applied, and emit grade.deactivated event', async () => {
      const mockChange = {
        id: 'change-1',
        entityId: 'grade-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        status: EffectiveChangeStatus.SCHEDULED,
      } as unknown as EffectiveChangeEntity;

      const mockGrade = {
        id: 'grade-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        status: MasterDataStatus.ACTIVE,
      } as Grade;

      (mockChangeRepo.findOne as jest.Mock).mockResolvedValue(mockChange);
      (mockGradeRepo.findOne as jest.Mock).mockResolvedValue(mockGrade);

      await handler.apply(
        {
          changeId: 'change-1',
          entityType: 'grade',
          operation: 'DEACTIVATE',
          tenantId: 'tenant-1',
          companyId: 'comp-1',
        },
        mockEntityManager as unknown as EntityManager,
      );

      expect(mockGrade.status).toBe(MasterDataStatus.INACTIVE);
      expect(mockGradeRepo.save).toHaveBeenCalledWith(mockGrade);
      expect(mockChange.status).toBe(EffectiveChangeStatus.APPLIED);
      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: GradeEventType.GRADE_DEACTIVATED,
        }),
      );
    });
  });
});
