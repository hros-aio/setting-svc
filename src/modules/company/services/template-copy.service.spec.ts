import { ForbiddenException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { TemplateCopyService } from './template-copy.service';
import { Grade } from '@new-hros/libs-sql';
import { JobTitle } from '@new-hros/libs-sql';
import { MasterDataStatus } from '../../../enums';
import { CopyableCategory } from '../enums/copyable-category.enum';

describe('TemplateCopyService', () => {
  let service: TemplateCopyService;
  let mockEntityManager: jest.Mocked<Partial<EntityManager>>;
  let mockGradeRepo: jest.Mocked<Partial<Repository<Grade>>>;
  let mockJobTitleRepo: jest.Mocked<Partial<Repository<JobTitle>>>;

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
        if (target === Grade) return mockGradeRepo;
        if (target === JobTitle) return mockJobTitleRepo;
        return {} as unknown as Repository<Grade>;
      }),
    };

    service = new TemplateCopyService();
  });

  it('should copy active grades and map their IDs to job titles', async () => {
    const tenantId = 'tenant-1';
    const sourceCompanyId = 'source-comp-1';
    const targetCompanyId = 'target-comp-1';

    const sourceGrades: Partial<Grade>[] = [
      {
        id: 'old-grade-1',
        tenantId,
        companyId: sourceCompanyId,
        code: 'G1',
        name: 'Grade 1',
        status: MasterDataStatus.ACTIVE,
      },
    ];

    const sourceJobTitles: Partial<JobTitle>[] = [
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

    (mockGradeRepo.find as jest.Mock).mockResolvedValue(sourceGrades as Grade[]);
    (mockJobTitleRepo.find as jest.Mock).mockResolvedValue(sourceJobTitles as JobTitle[]);

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

    const maliciousGrades: Partial<Grade>[] = [
      {
        id: 'old-grade-1',
        tenantId: 'other-tenant',
        companyId: sourceCompanyId,
        code: 'G1',
        name: 'Grade 1',
        status: MasterDataStatus.ACTIVE,
      },
    ];

    (mockGradeRepo.find as jest.Mock).mockResolvedValue(maliciousGrades as Grade[]);

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
