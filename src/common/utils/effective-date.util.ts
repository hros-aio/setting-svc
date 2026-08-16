export class EffectiveDateUtil {
  /**
   * Calculates the end of the current business day (23:59:59.999) in the specified timezone
   * and validates whether the given target effective date is on or after that boundary.
   */
  static validateFutureEffectiveDate(
    effectiveAt: Date | string,
    timezone?: string,
  ): { isValid: boolean; cutoff: Date } {
    const target = typeof effectiveAt === 'string' ? new Date(effectiveAt) : effectiveAt;
    const tz = timezone && timezone.trim().length > 0 ? timezone.trim() : 'UTC';

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
    // e.g. for UTC: 2026-08-16T23:59:59.999Z
    // Alternatively parse relative to timezone offset
    // Construct local midnight string and evaluate
    const localEndOfDayStr = `${year}-${month}-${day}T23:59:59.999`;

    // Compute timezone offset relative to UTC for that date
    // Create Date from target string
    // Calculate difference by parsing string representation
    let cutoff: Date;
    try {
      // Create a date assuming the timezone
      const localInTz = new Date(
        new Date(localEndOfDayStr).toLocaleString('en-US', { timeZone: tz }),
      );
      const localInUtc = new Date(localEndOfDayStr);
      const diff = localInUtc.getTime() - localInTz.getTime();
      cutoff = new Date(localInUtc.getTime() + diff);
    } catch {
      // Fallback to UTC end of day
      cutoff = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
      );
    }

    return {
      isValid: target.getTime() >= cutoff.getTime(),
      cutoff,
    };
  }
}
