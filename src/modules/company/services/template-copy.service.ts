import { ForbiddenException, Injectable } from '@nestjs/common';
import { Grade, JobTitle, TransactionService } from '@new-hros/libs-sql';
import { EntityManager } from 'typeorm';
import { MasterDataStatus } from '../../../enums';
import { CopyableCategory } from '../enums/copyable-category.enum';

export interface CopyResult {
  copiedGradesCount: number;
  copiedJobTitlesCount: number;
}

@Injectable()
export class TemplateCopyService {
  constructor(private readonly transactionService: TransactionService) {}

  private getManager(): EntityManager {
    return this.transactionService.getManager();
  }

  async copyLocalMasterData(
    tenantCode: string,
    sourceCompanyId: string,
    targetCompanyId: string,
    categories: CopyableCategory[],
  ): Promise<CopyResult> {
    const result: CopyResult = {
      copiedGradesCount: 0,
      copiedJobTitlesCount: 0,
    };

    if (!categories || categories.length === 0) {
      return result;
    }

    const selectedSet = new Set(categories);
    const gradeIdMap = new Map<string, string>();

    // 1. Copy Grades if selected
    if (selectedSet.has(CopyableCategory.GRADES)) {
      const sourceGrades = await this.getManager()
        .getRepository(Grade)
        .find({
          where: {
            tenantCode,
            companyId: sourceCompanyId,
            status: MasterDataStatus.ACTIVE,
          },
        });

      if (sourceGrades.length > 0) {
        for (const sourceGrade of sourceGrades) {
          if (sourceGrade.tenantCode !== tenantCode) {
            throw new ForbiddenException('Cross-tenant copy violation');
          }

          const newGrade = this.getManager().getRepository(Grade).create({
            tenantCode,
            companyId: targetCompanyId,
            code: sourceGrade.code,
            name: sourceGrade.name,
            description: sourceGrade.description,
            rankOrder: sourceGrade.rankOrder,
            sourceGradeId: sourceGrade.id,
            status: MasterDataStatus.ACTIVE,
            effectiveAt: new Date(),
          });

          const savedGrade = await this.getManager().getRepository(Grade).save(newGrade);
          gradeIdMap.set(sourceGrade.id, savedGrade.id);
          result.copiedGradesCount++;
        }
      }
    }

    // 2. Copy Job Titles if selected
    if (selectedSet.has(CopyableCategory.JOB_TITLES)) {
      const sourceJobTitles = await this.getManager()
        .getRepository(JobTitle)
        .find({
          where: {
            tenantCode,
            companyId: sourceCompanyId,
            status: MasterDataStatus.ACTIVE,
          },
        });

      if (sourceJobTitles.length > 0) {
        for (const sourceJobTitle of sourceJobTitles) {
          if (sourceJobTitle.tenantCode !== tenantCode) {
            throw new ForbiddenException('Cross-tenant copy violation');
          }

          const mappedGradeId = sourceJobTitle.gradeId
            ? gradeIdMap.get(sourceJobTitle.gradeId) || sourceJobTitle.gradeId
            : undefined;

          const newJobTitle = this.getManager().getRepository(JobTitle).create({
            tenantCode,
            companyId: targetCompanyId,
            code: sourceJobTitle.code,
            name: sourceJobTitle.name,
            description: sourceJobTitle.description,
            gradeId: mappedGradeId,
            departmentId: undefined, // Departments unlinked on copy
            sourceJobTitleId: sourceJobTitle.id,
            status: MasterDataStatus.ACTIVE,
            effectiveAt: new Date(),
          });

          await this.getManager().getRepository(JobTitle).save(newJobTitle);
          result.copiedJobTitlesCount++;
        }
      }
    }

    return result;
  }
}
