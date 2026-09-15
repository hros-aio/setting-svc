import { ForbiddenException } from '@nestjs/common';
import { Grade, JobTitle, TransactionService } from '@new-hros/libs-sql';
import { EntityManager, Repository } from 'typeorm';
import { MasterDataStatus } from '../../../enums';
import { CopyableCategory } from '../enums/copyable-category.enum';
import { TemplateCopyService } from './template-copy.service';

describe('TemplateCopyService', () => {
  let service: TemplateCopyService;
  let mockEntityManager: jest.Mocked<Partial<EntityManager>>;
  let mockGradeRepo: jest.Mocked<Partial<Repository<Grade>>>;
  let mockJobTitleRepo: jest.Mocked<Partial<Repository<JobTitle>>>;
  let mockTransactionService: jest.Mocked<Partial<TransactionService>>;

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

    mockTransactionService = {
      getManager: jest.fn().mockReturnValue(mockEntityManager as EntityManager),
    };

    service = new TemplateCopyService(mockTransactionService as TransactionService);
  });

  it('should copy active grades and map their IDs to job titles', async () => {
    const tenantCode = 'tenant-1';
    const sourceCompanyId = 'source-comp-1';
    const targetCompanyId = 'target-comp-1';

    const sourceGrades: Partial<Grade>[] = [
      {
        id: 'old-grade-1',
        tenantCode,
        companyId: sourceCompanyId,
        code: 'G1',
        name: 'Grade 1',
        status: MasterDataStatus.ACTIVE,
      },
    ];

    const sourceJobTitles: Partial<JobTitle>[] = [
      {
        id: 'old-jt-1',
        tenantCode,
        companyId: sourceCompanyId,
        code: 'ENG',
        name: 'Engineer',
        gradeId: 'old-grade-1',
        status: MasterDataStatus.ACTIVE,
      },
    ];

    (mockGradeRepo.find as jest.Mock).mockResolvedValue(sourceGrades as Grade[]);
    (mockJobTitleRepo.find as jest.Mock).mockResolvedValue(sourceJobTitles as JobTitle[]);

    const result = await service.copyLocalMasterData(tenantCode, sourceCompanyId, targetCompanyId, [
      CopyableCategory.GRADES,
      CopyableCategory.JOB_TITLES,
    ]);

    expect(result.copiedGradesCount).toBe(1);
    expect(result.copiedJobTitlesCount).toBe(1);
    expect(mockGradeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantCode,
        companyId: targetCompanyId,
        code: 'G1',
        sourceGradeId: 'old-grade-1',
      }),
    );
    expect(mockJobTitleRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantCode,
        companyId: targetCompanyId,
        code: 'ENG',
        gradeId: 'new-grade-id',
        sourceJobTitleId: 'old-jt-1',
      }),
    );
  });

  it('should throw ForbiddenException if a source entity belongs to a different tenant', async () => {
    const tenantCode = 'tenant-1';
    const sourceCompanyId = 'source-comp-1';
    const targetCompanyId = 'target-comp-1';

    const maliciousGrades: Partial<Grade>[] = [
      {
        id: 'old-grade-1',
        tenantCode: 'other-tenant',
        companyId: sourceCompanyId,
        code: 'G1',
        name: 'Grade 1',
        status: MasterDataStatus.ACTIVE,
      },
    ];

    (mockGradeRepo.find as jest.Mock).mockResolvedValue(maliciousGrades as Grade[]);

    await expect(
      service.copyLocalMasterData(tenantCode, sourceCompanyId, targetCompanyId, [
        CopyableCategory.GRADES,
      ]),
    ).rejects.toThrow(ForbiddenException);
  });
});
