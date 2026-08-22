import { BadRequestException } from '@nestjs/common';

export interface CompanyTimezoneHolder {
  timezone?: string | null;
}

export class EffectiveDateUtil {
  /**
   * Normalizes a given effectiveAt input to the exact start of the day (00:00:00.000)
   * in the specified timezone and returns the corresponding UTC Date.
   *
   * Example: '2026-08-25' in 'Asia/Ho_Chi_Minh' (UTC+7) -> '2026-08-24T17:00:00.000Z'
   */
  static parseToStartOfDayInTimezone(effectiveAt: Date | string, timezone?: string | null): Date {
    const tz = timezone && timezone.trim().length > 0 ? timezone.trim() : 'UTC';

    let dateStr = '';
    if (typeof effectiveAt === 'string') {
      dateStr = effectiveAt.slice(0, 10);
    } else if (effectiveAt instanceof Date) {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      dateStr = formatter.format(effectiveAt);
    }

    const localStartOfDayStr = `${dateStr}T00:00:00.000`;

    try {
      const localInTz = new Date(
        new Date(localStartOfDayStr).toLocaleString('en-US', { timeZone: tz }),
      );
      const localInUtc = new Date(localStartOfDayStr);
      const diff = localInUtc.getTime() - localInTz.getTime();
      return new Date(localInUtc.getTime() + diff);
    } catch {
      return new Date(`${dateStr}T00:00:00.000Z`);
    }
  }

  /**
   * Calculates the end of the current business day (23:59:59.999) in the specified timezone
   * and validates whether the given target effective date is on or after that boundary.
   */
  static validateFutureEffectiveDate(
    effectiveAt: Date | string,
    timezone?: string | null,
  ): { isValid: boolean; cutoff: Date; normalizedEffectiveAt: Date } {
    const tz = timezone && timezone.trim().length > 0 ? timezone.trim() : 'UTC';
    const normalizedEffectiveAt = this.parseToStartOfDayInTimezone(effectiveAt, tz);

    // Format current date in target timezone to obtain YYYY-MM-DD
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const partMap: Record<string, string> = {};
    for (const part of parts) {
      partMap[part.type] = part.value;
    }

    const year = partMap.year || `${now.getUTCFullYear()}`;
    const month = partMap.month || `${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const day = partMap.day || `${String(now.getUTCDate()).padStart(2, '0')}`;

    // End of current business day in ISO string representation for that timezone
    const localEndOfDayStr = `${year}-${month}-${day}T23:59:59.999`;

    let cutoff: Date;
    try {
      const localInTz = new Date(
        new Date(localEndOfDayStr).toLocaleString('en-US', { timeZone: tz }),
      );
      const localInUtc = new Date(localEndOfDayStr);
      const diff = localInUtc.getTime() - localInTz.getTime();
      cutoff = new Date(localInUtc.getTime() + diff);
    } catch {
      cutoff = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
      );
    }

    return {
      isValid: normalizedEffectiveAt.getTime() >= cutoff.getTime(),
      cutoff,
      normalizedEffectiveAt,
    };
  }

  /**
   * Common helper to validate effectiveAt against a company entity directly,
   * throwing BadRequestException if invalid format or not strictly in the future.
   * Returns the timezone-normalized effectiveAt Date.
   */
  static validateCompanyEffectiveDate(
    effectiveAt: string | Date,
    company: CompanyTimezoneHolder,
  ): { effectiveAtDate: Date; companyTimezone?: string } {
    const rawDate = typeof effectiveAt === 'string' ? new Date(effectiveAt) : effectiveAt;
    if (!rawDate || isNaN(rawDate.getTime())) {
      throw new BadRequestException('Invalid effectiveAt date format');
    }

    const tz = company?.timezone || 'UTC';
    const { isValid, cutoff, normalizedEffectiveAt } = this.validateFutureEffectiveDate(
      effectiveAt,
      tz,
    );

    if (!isValid) {
      throw new BadRequestException(
        `effectiveAt must be scheduled on or after the end of the current business day (${cutoff.toISOString()}) in company timezone (${tz})`,
      );
    }

    return {
      effectiveAtDate: normalizedEffectiveAt,
      companyTimezone: company?.timezone || undefined,
    };
  }
}
