import { BadRequestException } from '@nestjs/common';
import { EffectiveDateUtil } from './effective-date.util';

describe('EffectiveDateUtil', () => {
  describe('parseToStartOfDayInTimezone', () => {
    it('should parse YYYY-MM-DD string to start of day in Asia/Ho_Chi_Minh (UTC+7)', () => {
      const result = EffectiveDateUtil.parseToStartOfDayInTimezone(
        '2026-08-25',
        'Asia/Ho_Chi_Minh',
      );
      // 2026-08-25 00:00:00.000 in UTC+7 is 2026-08-24T17:00:00.000Z
      expect(result.toISOString()).toBe('2026-08-24T17:00:00.000Z');
    });

    it('should default to UTC if no timezone is provided or invalid timezone provided', () => {
      const result1 = EffectiveDateUtil.parseToStartOfDayInTimezone('2026-08-25');
      expect(result1.toISOString()).toBe('2026-08-25T00:00:00.000Z');

      const result2 = EffectiveDateUtil.parseToStartOfDayInTimezone(
        '2026-08-25',
        'Invalid/Timezone',
      );
      expect(result2.toISOString()).toBe('2026-08-25T00:00:00.000Z');
    });
  });

  describe('validateFutureEffectiveDate', () => {
    it('should validate and return normalizedEffectiveAt for future date', () => {
      const futureDate = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);
      const validation = EffectiveDateUtil.validateFutureEffectiveDate(
        futureDate,
        'Asia/Ho_Chi_Minh',
      );
      expect(validation.isValid).toBe(true);
      expect(validation.normalizedEffectiveAt).toBeDefined();
    });
  });

  describe('validateCompanyEffectiveDate', () => {
    it('should accept valid future date with company entity', () => {
      const futureDate = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);
      const res = EffectiveDateUtil.validateCompanyEffectiveDate(futureDate, {
        timezone: 'Asia/Ho_Chi_Minh',
      });
      expect(res.effectiveAtDate).toBeInstanceOf(Date);
      expect(res.companyTimezone).toBe('Asia/Ho_Chi_Minh');
    });

    it('should throw BadRequestException on invalid date string', () => {
      expect(() =>
        EffectiveDateUtil.validateCompanyEffectiveDate('invalid-date', {
          timezone: 'Asia/Ho_Chi_Minh',
        }),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException on invalid calendar rollover dates (e.g. 2027-02-29, 2027-04-31)', () => {
      expect(() =>
        EffectiveDateUtil.validateCompanyEffectiveDate('2027-02-29', {
          timezone: 'Asia/Ho_Chi_Minh',
        }),
      ).toThrow(BadRequestException);

      expect(() =>
        EffectiveDateUtil.validateCompanyEffectiveDate('2027-04-31', {
          timezone: 'Asia/Ho_Chi_Minh',
        }),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException on past date', () => {
      expect(() =>
        EffectiveDateUtil.validateCompanyEffectiveDate('2020-01-01', {
          timezone: 'Asia/Ho_Chi_Minh',
        }),
      ).toThrow(BadRequestException);
    });
  });
});
