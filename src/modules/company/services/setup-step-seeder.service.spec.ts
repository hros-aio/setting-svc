import { BadRequestException } from '@nestjs/common';
import { SetupStepSeederService } from './setup-step-seeder.service';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';
import { SetupStepStatus, SetupStepType } from '../../../enums';
import { CopyableCategory } from '../enums/copyable-category.enum';

describe('SetupStepSeederService', () => {
  let service: SetupStepSeederService;
  let mockRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;

  beforeEach(() => {
    mockRepo = {
      bulkCreateAndSave: jest.fn().mockImplementation((steps) => Promise.resolve(steps)),
    };
    service = new SetupStepSeederService(mockRepo as unknown as CompanySetupStepRepository);
  });

  it('should seed 8 incomplete setup steps when no categories are copied', async () => {
    const tenantId = 'tenant-uuid-1';
    const companyId = 'company-uuid-1';

    const result = await service.seedMandatorySteps(tenantId, companyId, []);

    expect(mockRepo.bulkCreateAndSave).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(8);
    result.forEach((step) => {
      expect(step.status).toBe(SetupStepStatus.INCOMPLETE);
      expect(step.completedAt).toBeUndefined();
      expect(step.tenantId).toBe(tenantId);
      expect(step.companyId).toBe(companyId);
    });
  });

  it('should mark GRADE and JOB_TITLE as COMPLETED when their categories are in copiedCategories', async () => {
    const tenantId = 'tenant-uuid-1';
    const companyId = 'company-uuid-1';

    const result = await service.seedMandatorySteps(tenantId, companyId, [
      CopyableCategory.GRADES,
      CopyableCategory.JOB_TITLES,
    ]);

    expect(result).toHaveLength(8);
    const gradeStep = result.find((s) => s.stepType === SetupStepType.GRADE);
    const jobTitleStep = result.find((s) => s.stepType === SetupStepType.JOB_TITLE);
    const roleStep = result.find((s) => s.stepType === SetupStepType.ROLE);

    expect(gradeStep?.status).toBe(SetupStepStatus.COMPLETED);
    expect(gradeStep?.completedAt).toBeDefined();
    expect(gradeStep?.metadata).toEqual({ completedViaCopy: true });

    expect(jobTitleStep?.status).toBe(SetupStepStatus.COMPLETED);
    expect(roleStep?.status).toBe(SetupStepStatus.INCOMPLETE);
  });

  it('should throw BadRequestException if tenantId or companyId is missing', async () => {
    await expect(service.seedMandatorySteps('', 'comp-1')).rejects.toThrow(BadRequestException);
    await expect(service.seedMandatorySteps('ten-1', '')).rejects.toThrow(BadRequestException);
  });
});
