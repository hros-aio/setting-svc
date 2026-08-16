import { JobTitleApplyHandler } from '../../src/modules/effective-change/handlers/job-title-apply.handler';
import { JobTitleEntity } from '../../src/modules/job-title/entities/job-title.entity';
import { EffectiveChangeEntity } from '../../src/modules/effective-change/entities/effective-change.entity';
import { OutboxEventEntity } from '../../src/modules/company/entities/outbox-event.entity';
import { EffectiveChangeStatus, JobTitleEventType, MasterDataStatus } from '../../src/enums';
import { DataSource, EntityManager, Repository } from 'typeorm';

describe('JobTitleApplyHandler [US5]', () => {
  let handler: JobTitleApplyHandler;
  let mockJobTitleRepo: jest.Mocked<Partial<Repository<JobTitleEntity>>>;
  let mockChangeRepo: jest.Mocked<Partial<Repository<EffectiveChangeEntity>>>;
  let mockOutboxRepo: jest.Mocked<Partial<Repository<OutboxEventEntity>>>;
  let mockEntityManager: jest.Mocked<Partial<EntityManager>>;

  beforeEach(() => {
    mockJobTitleRepo = {
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
        if (entityClass === JobTitleEntity) return mockJobTitleRepo;
        if (entityClass === EffectiveChangeEntity) return mockChangeRepo;
        if (entityClass === OutboxEventEntity) return mockOutboxRepo;
        return null;
      }),
    };

    handler = new JobTitleApplyHandler({
      manager: mockEntityManager as unknown as EntityManager,
    } as unknown as DataSource);
  });

  describe('apply CREATE', () => {
    it('should transition job title from scheduled to active and emit job-title.created event', async () => {
      const mockJobTitle = {
        id: 'job-title-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        code: 'SWE',
        name: 'Software Engineer',
        departmentId: 'dept-1',
        gradeId: 'grade-1',
        status: MasterDataStatus.SCHEDULED,
        effectiveAt: new Date('2026-08-20T00:00:00.000Z'),
      } as JobTitleEntity;

      (mockJobTitleRepo.findOne as jest.Mock).mockResolvedValue(mockJobTitle);

      await handler.apply(
        {
          changeId: 'job-title-1',
          entityType: 'job_title',
          operation: 'CREATE',
          tenantId: 'tenant-1',
          companyId: 'comp-1',
        },
        mockEntityManager as unknown as EntityManager,
      );

      expect(mockJobTitle.status).toBe(MasterDataStatus.ACTIVE);
      expect(mockJobTitleRepo.save).toHaveBeenCalledWith(mockJobTitle);
      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: JobTitleEventType.JOB_TITLE_CREATED,
        }),
      );
      expect(mockOutboxRepo.save).toHaveBeenCalled();
    });

    it('should idempotent skip if job title is already active', async () => {
      const mockJobTitle = {
        id: 'job-title-1',
        status: MasterDataStatus.ACTIVE,
      } as JobTitleEntity;

      (mockJobTitleRepo.findOne as jest.Mock).mockResolvedValue(mockJobTitle);

      await handler.apply(
        {
          changeId: 'job-title-1',
          entityType: 'job_title',
          operation: 'CREATE',
          tenantId: 'tenant-1',
          companyId: 'comp-1',
        },
        mockEntityManager as unknown as EntityManager,
      );

      expect(mockJobTitleRepo.save).not.toHaveBeenCalled();
      expect(mockOutboxRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('apply UPDATE', () => {
    it('should apply payload fields to job title, mark change applied, and emit job-title.updated event', async () => {
      const mockChange = {
        id: 'change-1',
        entityId: 'job-title-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        status: EffectiveChangeStatus.SCHEDULED,
        payload: {
          name: 'Senior Software Engineer',
          gradeId: 'grade-2',
        },
      } as unknown as EffectiveChangeEntity;

      const mockJobTitle = {
        id: 'job-title-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        name: 'Software Engineer',
        gradeId: 'grade-1',
        status: MasterDataStatus.ACTIVE,
      } as JobTitleEntity;

      (mockChangeRepo.findOne as jest.Mock).mockResolvedValue(mockChange);
      (mockJobTitleRepo.findOne as jest.Mock).mockResolvedValue(mockJobTitle);

      await handler.apply(
        {
          changeId: 'change-1',
          entityType: 'job_title',
          operation: 'UPDATE',
          tenantId: 'tenant-1',
          companyId: 'comp-1',
        },
        mockEntityManager as unknown as EntityManager,
      );

      expect(mockJobTitle.name).toBe('Senior Software Engineer');
      expect(mockJobTitle.gradeId).toBe('grade-2');
      expect(mockJobTitleRepo.save).toHaveBeenCalledWith(mockJobTitle);
      expect(mockChange.status).toBe(EffectiveChangeStatus.APPLIED);
      expect(mockChangeRepo.save).toHaveBeenCalledWith(mockChange);
      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: JobTitleEventType.JOB_TITLE_UPDATED,
        }),
      );
    });
  });

  describe('apply DEACTIVATE', () => {
    it('should set job title to inactive, mark change applied, and emit job-title.deactivated event', async () => {
      const mockChange = {
        id: 'change-1',
        entityId: 'job-title-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        status: EffectiveChangeStatus.SCHEDULED,
      } as unknown as EffectiveChangeEntity;

      const mockJobTitle = {
        id: 'job-title-1',
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        status: MasterDataStatus.ACTIVE,
      } as JobTitleEntity;

      (mockChangeRepo.findOne as jest.Mock).mockResolvedValue(mockChange);
      (mockJobTitleRepo.findOne as jest.Mock).mockResolvedValue(mockJobTitle);

      await handler.apply(
        {
          changeId: 'change-1',
          entityType: 'job_title',
          operation: 'DEACTIVATE',
          tenantId: 'tenant-1',
          companyId: 'comp-1',
        },
        mockEntityManager as unknown as EntityManager,
      );

      expect(mockJobTitle.status).toBe(MasterDataStatus.INACTIVE);
      expect(mockJobTitleRepo.save).toHaveBeenCalledWith(mockJobTitle);
      expect(mockChange.status).toBe(EffectiveChangeStatus.APPLIED);
      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: JobTitleEventType.JOB_TITLE_DEACTIVATED,
        }),
      );
    });
  });
});
