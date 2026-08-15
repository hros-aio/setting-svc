import { BadRequestException } from '@nestjs/common';
import { SetupStepStatus } from '../../../enums';
import { MANDATORY_SETUP_STEPS_SEQUENCE } from '../enums/mandatory-setup-steps.enum';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';
import { SetupStepSeederService } from './setup-step-seeder.service';

describe('SetupStepSeederService', () => {
  let service: SetupStepSeederService;
  let mockSetupStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;

  beforeEach(() => {
    mockSetupStepRepo = {
      bulkCreateAndSave: jest.fn().mockImplementation((steps) => Promise.resolve(steps)),
    };
    service = new SetupStepSeederService(
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
    );
  });

  it('should throw BadRequestException if tenantId or companyId is missing', async () => {
    await expect(service.seedMandatorySteps('', 'comp-1')).rejects.toThrow(BadRequestException);
    await expect(service.seedMandatorySteps('ten-1', '')).rejects.toThrow(BadRequestException);
  });

  it('should seed exactly 8 mandatory setup steps in fixed sequential order and INCOMPLETE status', async () => {
    const tenantId = 'test-tenant-uuid';
    const companyId = 'test-company-uuid';

    const result = await service.seedMandatorySteps(tenantId, companyId);

    expect(mockSetupStepRepo.bulkCreateAndSave).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(8);
    expect(result.map((s) => s.stepOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.every((s) => s.status === SetupStepStatus.INCOMPLETE)).toBe(true);
    expect(result.every((s) => s.tenantId === tenantId && s.companyId === companyId)).toBe(true);
    expect(result.map((s) => s.stepType)).toEqual(
      MANDATORY_SETUP_STEPS_SEQUENCE.map((s) => s.type),
    );
  });
});
