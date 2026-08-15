import { ForbiddenException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { TemplateCopyService } from './template-copy.service';
import { GradeEntity } from '../../grade/entities/grade.entity';
import { JobTitleEntity } from '../../job-title/entities/job-title.entity';
import { MasterDataStatus } from '../../../enums';
import { CopyableCategory } from '../enums/copyable-category.enum';

describe('TemplateCopyService', () => {
  let service: TemplateCopyService;
  let mockEntityManager: jest.Mocked<Partial<EntityManager>>;
  let mockGradeRepo: jest.Mocked<Partial<Repository<GradeEntity>>>;
  let mockJobTitleRepo: jest.Mocked<Partial<Repository<JobTitleEntity>>>;

  beforeEach(() => {
    mockGradeRepo = {
      find: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ id: 'new-grade-id', ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockJobTitleRepo = {
      find: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ id: 'new-job-title-id', ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockEntityManager = {
      getRepository: jest.fn().mockImplementation((target) => {
        if (target === GradeEntity) return mockGradeRepo;
        if (target === JobTitleEntity) return mockJobTitleRepo;
        return {} as unknown as Repository<GradeEntity>;
      }),
    };

    service = new TemplateCopyService();
  });

  it('should copy active grades and map their IDs to job titles', async () => {
    const tenantId = 'tenant-1';
    const sourceCompanyId = 'source-comp-1';
    const targetCompanyId = 'target-comp-1';

    const sourceGrades: Partial<GradeEntity>[] = [
      {
        id: 'old-grade-1',
        tenantId,
        companyId: sourceCompanyId,
        code: 'G1',
        name: 'Grade 1',
        status: MasterDataStatus.ACTIVE,
      },
    ];

    const sourceJobTitles: Partial<JobTitleEntity>[] = [
      {
        id: 'old-jt-1',
        tenantId,
        companyId: sourceCompanyId,
        code: 'ENG',
        name: 'Engineer',
        gradeId: 'old-grade-1',
        status: MasterDataStatus.ACTIVE,
      },
    ];

    (mockGradeRepo.find as jest.Mock).mockResolvedValue(sourceGrades as GradeEntity[]);
    (mockJobTitleRepo.find as jest.Mock).mockResolvedValue(sourceJobTitles as JobTitleEntity[]);

    const result = await service.copyLocalMasterData(
      mockEntityManager as unknown as EntityManager,
      tenantId,
      sourceCompanyId,
      targetCompanyId,
      [CopyableCategory.GRADES, CopyableCategory.JOB_TITLES],
    );

    expect(result.copiedGradesCount).toBe(1);
    expect(result.copiedJobTitlesCount).toBe(1);
    expect(mockGradeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        companyId: targetCompanyId,
        code: 'G1',
        sourceGradeId: 'old-grade-1',
      }),
    );
    expect(mockJobTitleRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        companyId: targetCompanyId,
        code: 'ENG',
        gradeId: 'new-grade-id',
        sourceJobTitleId: 'old-jt-1',
      }),
    );
  });

  it('should throw ForbiddenException if a source entity belongs to a different tenant', async () => {
    const tenantId = 'tenant-1';
    const sourceCompanyId = 'source-comp-1';
    const targetCompanyId = 'target-comp-1';

    const maliciousGrades: Partial<GradeEntity>[] = [
      {
        id: 'old-grade-1',
        tenantId: 'other-tenant',
        companyId: sourceCompanyId,
        code: 'G1',
        name: 'Grade 1',
        status: MasterDataStatus.ACTIVE,
      },
    ];

    (mockGradeRepo.find as jest.Mock).mockResolvedValue(maliciousGrades as GradeEntity[]);

    await expect(
      service.copyLocalMasterData(
        mockEntityManager as unknown as EntityManager,
        tenantId,
        sourceCompanyId,
        targetCompanyId,
        [CopyableCategory.GRADES],
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
