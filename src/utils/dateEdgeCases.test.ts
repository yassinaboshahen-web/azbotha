import { describe, it, expect } from 'vitest';
import {
  parseCalendarDate,
  formatCalendarDate,
  combineDateAndTime,
  isCalendarDateString,
  getWeekRange,
  getMonthRange,
  isLeapYear,
  getDaysInMonth,
  clampDateToRange,
} from './dateUtils';

describe('Date/Time Edge Cases & Production Validation', () => {
  it('handles invalid dates and malformed strings safely without throwing or returning NaN', () => {
    const invalidParsed = parseCalendarDate('not-a-date');
    expect(invalidParsed).toBeInstanceOf(Date);
    expect(isNaN(invalidParsed.getTime())).toBe(false);

    const clamped = clampDateToRange('invalid');
    expect(isCalendarDateString(clamped)).toBe(true);
  });

  it('handles midnight (00:00) and late night (23:59) boundary combinations', () => {
    const dtStart = combineDateAndTime('2026-10-01', '00:00');
    expect(dtStart.getHours()).toBe(0);
    expect(dtStart.getMinutes()).toBe(0);

    const dtEnd = combineDateAndTime('2026-10-01', '23:59');
    expect(dtEnd.getHours()).toBe(23);
    expect(dtEnd.getMinutes()).toBe(59);
  });

  it('validates leap years and February day counts correctly', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(getDaysInMonth(2024, 1)).toBe(29); // Feb 2024

    expect(isLeapYear(2025)).toBe(false);
    expect(getDaysInMonth(2025, 1)).toBe(28); // Feb 2025
  });

  it('handles year and month boundary transitions seamlessly', () => {
    const rangeDec = getMonthRange('2026-12-15');
    expect(rangeDec.startDate).toBe('2026-12-01');
    expect(rangeDec.endDate).toBe('2026-12-31');

    const weekYearEnd = getWeekRange('2026-12-31', 'saturday');
    expect(isCalendarDateString(weekYearEnd.startDate)).toBe(true);
    expect(isCalendarDateString(weekYearEnd.endDate)).toBe(true);
  });
});
