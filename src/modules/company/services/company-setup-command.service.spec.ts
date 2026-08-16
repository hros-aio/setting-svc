import { NotFoundException } from '@nestjs/common';
import { SetupStepStatus, SetupStepType } from '../../../enums';
import { CompanySetupStepEntity } from '../entities/company-setup-step.entity';
import { CompanySetupStepRepository } from '../repositories/company-setup-step.repository';
import { CompanySetupCommandService } from './company-setup-command.service';

describe('CompanySetupCommandService', () => {
  let service: CompanySetupCommandService;
  let mockSetupStepRepo: jest.Mocked<Partial<CompanySetupStepRepository>>;

  const tenantId = 'tenant-1';
  const companyId = 'company-1';

  beforeEach(() => {
    mockSetupStepRepo = {
      markStepCompleted: jest.fn(),
    };

    service = new CompanySetupCommandService(
      mockSetupStepRepo as unknown as CompanySetupStepRepository,
    );
  });

  describe('markStepComplete', () => {
    it('should mark step completed and return entity', async () => {
      const completedStep = {
        id: 'step-1',
        tenantId,
        companyId,
        stepType: SetupStepType.LOCATION,
        status: SetupStepStatus.COMPLETED,
        completedAt: new Date(),
        completedBy: 'user-1',
        metadata: { source: 'unit-test' },
      } as unknown as CompanySetupStepEntity;

      mockSetupStepRepo.markStepCompleted = jest.fn().mockResolvedValue(completedStep);

      const result = await service.markStepComplete({
        tenantId,
        companyId,
        stepType: SetupStepType.LOCATION,
        completedBy: 'user-1',
        metadata: { source: 'unit-test' },
      });

      expect(result).toEqual(completedStep);
      expect(mockSetupStepRepo.markStepCompleted).toHaveBeenCalledWith({
        tenantId,
        companyId,
        stepType: SetupStepType.LOCATION,
        completedBy: 'user-1',
        metadata: { source: 'unit-test' },
        entityManager: undefined,
      });
    });

    it('should throw NotFoundException if step is not found', async () => {
      mockSetupStepRepo.markStepCompleted = jest.fn().mockResolvedValue(null);

      await expect(
        service.markStepComplete({
          tenantId,
          companyId,
          stepType: SetupStepType.LOCATION,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
