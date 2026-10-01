import { describe, it, expect } from 'vitest';
import {
  addOneHourToTime,
  checkEventsTimeOverlap,
  suggestCategoryFromTitle,
  timeStringToMinutes,
  getTaskDate,
  isLeapYear,
  getDaysInMonth,
  clampDateToRange,
  createEventsByDateMap,
  createTasksByDateMap,
  parseDateString,
  formatDateToISO,
  isCalendarDateString,
  parseCalendarDate,
  formatCalendarDate,
  combineDateAndTime,
  getWeekRange,
  getMonthRange,
  getEventStatus,
} from './dateUtils';
import { CalendarEvent, TaskItem } from '../types';

describe('dateUtils - Calendar Date vs UTC & Parsing Integrity', () => {
  it('should validate canonical YYYY-MM-DD calendar date strings', () => {
    expect(isCalendarDateString('2026-10-01')).toBe(true);
    expect(isCalendarDateString('2024-02-29')).toBe(true);
    expect(isCalendarDateString('2025-02-29')).toBe(false); // 2025 not a leap year
    expect(isCalendarDateString('2026-13-01')).toBe(false); // Invalid month
    expect(isCalendarDateString('invalid')).toBe(false);
    expect(isCalendarDateString('')).toBe(false);
    expect(isCalendarDateString(null)).toBe(false);
  });

  it('should parse calendar date without UTC date shifting', () => {
    const d = parseCalendarDate('2026-10-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9); // 0-indexed October
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);

    // Re-formatting back to string must match exact original date
    expect(formatCalendarDate(d)).toBe('2026-10-01');
  });

  it('should ignore attached ISO time/timezone when parsing calendar date', () => {
    const d1 = parseCalendarDate('2026-10-01T23:59:59.999Z');
    expect(formatCalendarDate(d1)).toBe('2026-10-01');

    const d2 = parseCalendarDate('2026-10-01T00:00:00.000Z');
    expect(formatCalendarDate(d2)).toBe('2026-10-01');
  });

  it('should combine calendar date and 24h time into local DateTime safely', () => {
    const dt = combineDateAndTime('2026-10-01', '14:30');
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(9);
    expect(dt.getDate()).toBe(1);
    expect(dt.getHours()).toBe(14);
    expect(dt.getMinutes()).toBe(30);

    // Midnight 00:00
    const dtMidnight = combineDateAndTime('2026-10-01', '00:00');
    expect(dtMidnight.getHours()).toBe(0);
    expect(dtMidnight.getMinutes()).toBe(0);

    // Late night 23:59
    const dtNight = combineDateAndTime('2026-10-01', '23:59');
    expect(dtNight.getHours()).toBe(23);
    expect(dtNight.getMinutes()).toBe(59);
  });
});

describe('dateUtils - Week Range & Saturday Week Start (Egypt / Arabic Culture)', () => {
  it('should calculate week range starting Saturday for a Saturday date', () => {
    // 2026-10-03 is Saturday
    const range = getWeekRange('2026-10-03', 'saturday');
    expect(range.startDate).toBe('2026-10-03'); // Saturday
    expect(range.endDate).toBe('2026-10-09'); // Friday
  });

  it('should calculate week range starting Saturday for a Friday date (end of week)', () => {
    // 2026-10-09 is Friday
    const range = getWeekRange('2026-10-09', 'saturday');
    expect(range.startDate).toBe('2026-10-03'); // Saturday
    expect(range.endDate).toBe('2026-10-09'); // Friday
  });

  it('should calculate week range starting Saturday for mid-week days (Sunday, Wednesday)', () => {
    // 2026-10-04 is Sunday
    const rangeSun = getWeekRange('2026-10-04', 'saturday');
    expect(rangeSun.startDate).toBe('2026-10-03');
    expect(rangeSun.endDate).toBe('2026-10-09');

    // 2026-10-07 is Wednesday
    const rangeWed = getWeekRange('2026-10-07', 'saturday');
    expect(rangeWed.startDate).toBe('2026-10-03');
    expect(rangeWed.endDate).toBe('2026-10-09');
  });

  it('should handle week range across month boundaries', () => {
    // 2026-10-31 is Saturday. Next Friday is 2026-11-06
    const range = getWeekRange('2026-11-02', 'saturday'); // Monday Nov 2
    expect(range.startDate).toBe('2026-10-31'); // Sat Oct 31
    expect(range.endDate).toBe('2026-11-06'); // Fri Nov 6
  });

  it('should handle week range across year boundaries', () => {
    // 2026-12-26 is Saturday. Friday is 2027-01-01
    const range = getWeekRange('2026-12-30', 'saturday'); // Wed Dec 30
    expect(range.startDate).toBe('2026-12-26'); // Sat Dec 26, 2026
    expect(range.endDate).toBe('2027-01-01'); // Fri Jan 1, 2027
  });

  it('should handle week range in February during leap year vs non-leap year', () => {
    // 2024 is leap year. Feb 29 2024 is Thursday.
    const rangeLeap = getWeekRange('2024-02-29', 'saturday');
    expect(rangeLeap.startDate).toBe('2024-02-24'); // Sat Feb 24
    expect(rangeLeap.endDate).toBe('2024-03-01'); // Fri Mar 1
  });
});

describe('dateUtils - Month Range & Boundaries', () => {
  it('should calculate month range for standard months', () => {
    const octRange = getMonthRange('2026-10-15');
    expect(octRange.startDate).toBe('2026-10-01');
    expect(octRange.endDate).toBe('2026-10-31');

    const aprRange = getMonthRange('2026-04-10');
    expect(aprRange.startDate).toBe('2026-04-01');
    expect(aprRange.endDate).toBe('2026-04-30');
  });

  it('should calculate month range for February in leap vs non-leap years', () => {
    const febNonLeap = getMonthRange('2025-02-10');
    expect(febNonLeap.startDate).toBe('2025-02-01');
    expect(febNonLeap.endDate).toBe('2025-02-28');

    const febLeap = getMonthRange('2024-02-10');
    expect(febLeap.startDate).toBe('2024-02-01');
    expect(febLeap.endDate).toBe('2024-02-29');
  });

  it('should calculate month range for December and January boundaries', () => {
    const decRange = getMonthRange('2026-12-31');
    expect(decRange.startDate).toBe('2026-12-01');
    expect(decRange.endDate).toBe('2026-12-31');

    const janRange = getMonthRange('2027-01-01');
    expect(janRange.startDate).toBe('2027-01-01');
    expect(janRange.endDate).toBe('2027-01-31');
  });
});

describe('dateUtils - addOneHourToTime', () => {
  it('should add 1 hour to standard daytime hours', () => {
    expect(addOneHourToTime('10:00')).toBe('11:00');
    expect(addOneHourToTime('09:30')).toBe('10:30');
    expect(addOneHourToTime('12:15')).toBe('13:15');
    expect(addOneHourToTime('14:45')).toBe('15:45');
  });

  it('should correctly handle midnight and 00:00 start', () => {
    expect(addOneHourToTime('00:00')).toBe('01:00');
    expect(addOneHourToTime('00:30')).toBe('01:30');
  });

  it('should rollover from 23:xx to 00:xx', () => {
    expect(addOneHourToTime('23:00')).toBe('00:00');
    expect(addOneHourToTime('23:45')).toBe('00:45');
  });

  it('should return empty string for empty or invalid input', () => {
    expect(addOneHourToTime('')).toBe('');
    expect(addOneHourToTime('invalid')).toBe('');
  });
});

describe('dateUtils - Time validation (endTime > startTime)', () => {
  const isValidTimeRange = (startTime: string, endTime?: string): boolean => {
    if (!startTime || !startTime.trim()) return false;
    if (!endTime || !endTime.trim()) return true; // Optional end time is valid
    return timeStringToMinutes(endTime) > timeStringToMinutes(startTime);
  };

  it('should accept valid time range where endTime is strictly after startTime', () => {
    expect(isValidTimeRange('10:00', '11:00')).toBe(true);
    expect(isValidTimeRange('09:00', '09:30')).toBe(true);
    expect(isValidTimeRange('00:00', '01:00')).toBe(true);
  });

  it('should accept empty or missing endTime (no end time)', () => {
    expect(isValidTimeRange('10:00', '')).toBe(true);
    expect(isValidTimeRange('10:00', undefined)).toBe(true);
  });

  it('should reject endTime that is earlier than or equal to startTime', () => {
    expect(isValidTimeRange('12:00', '12:00')).toBe(false);
    expect(isValidTimeRange('13:00', '12:00')).toBe(false);
    expect(isValidTimeRange('10:30', '10:00')).toBe(false);
  });
});

describe('dateUtils - checkEventsTimeOverlap', () => {
  it('should detect overlap when both events start at 00:00 (preserving 00:00 as valid time)', () => {
    const eventA = { time: '00:00' }; // defaults to 00:00 - 01:00
    const eventB = { time: '00:00' }; // defaults to 00:00 - 01:00
    expect(checkEventsTimeOverlap(eventA, eventB)).toBe(true);
  });

  it('should detect overlap between 00:00 and 00:30', () => {
    const eventA = { time: '00:00' }; // 00:00 - 01:00
    const eventB = { time: '00:30' }; // 00:30 - 01:30
    expect(checkEventsTimeOverlap(eventA, eventB)).toBe(true);
  });

  it('should not detect overlap when events are adjacent on boundary at 01:00', () => {
    const eventA = { time: '00:00', endTime: '01:00' };
    const eventB = { time: '01:00', endTime: '02:00' };
    expect(checkEventsTimeOverlap(eventA, eventB)).toBe(false);
  });

  it('should assume 1-hour duration when endTime is not specified', () => {
    const eventA = { time: '14:00' }; // 14:00 - 15:00
    const eventB = { time: '14:45' }; // 14:45 - 15:45
    expect(checkEventsTimeOverlap(eventA, eventB)).toBe(true);

    const eventC = { time: '15:00' }; // 15:00 - 16:00
    expect(checkEventsTimeOverlap(eventA, eventC)).toBe(false);
  });

  it('should correctly handle explicit endTimes', () => {
    const eventA = { time: '10:00', endTime: '12:00' };
    const eventB = { time: '11:00', endTime: '11:30' };
    expect(checkEventsTimeOverlap(eventA, eventB)).toBe(true);

    const eventC = { time: '12:30', endTime: '13:30' };
    expect(checkEventsTimeOverlap(eventA, eventC)).toBe(false);
  });

  it('should return false for invalid or missing times', () => {
    expect(checkEventsTimeOverlap({ time: '' }, { time: '10:00' })).toBe(false);
    expect(checkEventsTimeOverlap({ time: '10:00' }, { time: '' })).toBe(false);
  });
});

describe('dateUtils - suggestCategoryFromTitle', () => {
  it('should suggest workout for gym and training keywords', () => {
    expect(suggestCategoryFromTitle('جيم الصبح بدري')).toBe('workout');
    expect(suggestCategoryFromTitle('تمرين كارديو')).toBe('workout');
  });

  it('should suggest meeting for meeting keywords', () => {
    expect(suggestCategoryFromTitle('ميتينج الشغل الأسبوعي')).toBe('meeting');
    expect(suggestCategoryFromTitle('اجتماع مع العميل')).toBe('meeting');
  });

  it('should suggest lecture for lecture keyword', () => {
    expect(suggestCategoryFromTitle('محاضرة ميكانيكا')).toBe('lecture');
  });

  it('should suggest section for section keyword', () => {
    expect(suggestCategoryFromTitle('سكشن كيمياء')).toBe('section');
  });

  it('should suggest study for study keyword', () => {
    expect(suggestCategoryFromTitle('مذاكرة امتحان الفاينال')).toBe('study');
  });

  it('should default to custom for unmatched titles or empty string', () => {
    expect(suggestCategoryFromTitle('خروجة مع صحابي')).toBe('custom');
    expect(suggestCategoryFromTitle('شراء مستلزمات البيت')).toBe('custom');
    expect(suggestCategoryFromTitle('')).toBe('custom');
  });
});

describe('dateUtils - getTaskDate', () => {
  it('should prioritize due_date when present', () => {
    const task = { id: 't1', title: 'Task 1', due_date: '2026-10-15', date: '2026-10-10' };
    expect(getTaskDate(task)).toBe('2026-10-15');
  });

  it('should fallback to date when due_date is missing', () => {
    const task = { id: 't2', title: 'Task 2', date: '2026-10-12' };
    expect(getTaskDate(task)).toBe('2026-10-12');
  });

  it('should fallback to date when due_date is empty string or null', () => {
    const task1 = { id: 't3', title: 'Task 3', due_date: '', date: '2026-10-20' };
    expect(getTaskDate(task1)).toBe('2026-10-20');

    const task2 = { id: 't4', title: 'Task 4', due_date: null, date: '2026-10-22' };
    expect(getTaskDate(task2)).toBe('2026-10-22');
  });

  it('should return empty string when both due_date and date are absent or undefined', () => {
    expect(getTaskDate({ id: 't5', title: 'Task 5' })).toBe('');
    expect(getTaskDate(null)).toBe('');
    expect(getTaskDate(undefined)).toBe('');
  });
});

describe('dateUtils - leap years & getDaysInMonth', () => {
  it('should correctly identify leap years', () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2021)).toBe(false);
    expect(isLeapYear(2022)).toBe(false);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
  });

  it('should return correct number of days for all months including February leap years', () => {
    // Jan (0), Feb (1), Mar (2), Apr (3), May (4), Jun (5), Jul (6), Aug (7), Sep (8), Oct (9), Nov (10), Dec (11)
    expect(getDaysInMonth(2026, 0)).toBe(31); // Jan
    expect(getDaysInMonth(2024, 1)).toBe(29); // Feb in leap year
    expect(getDaysInMonth(2025, 1)).toBe(28); // Feb in non-leap year
    expect(getDaysInMonth(2000, 1)).toBe(29); // Feb 2000 (leap year)
    expect(getDaysInMonth(2100, 1)).toBe(28); // Feb 2100 (non-leap year)
    expect(getDaysInMonth(2026, 3)).toBe(30); // Apr
    expect(getDaysInMonth(2026, 6)).toBe(31); // Jul
    expect(getDaysInMonth(2026, 7)).toBe(31); // Aug
    expect(getDaysInMonth(2026, 8)).toBe(30); // Sep
    expect(getDaysInMonth(2026, 9)).toBe(31); // Oct
    expect(getDaysInMonth(2026, 10)).toBe(30); // Nov
    expect(getDaysInMonth(2026, 11)).toBe(31); // Dec
  });
});

describe('dateUtils - clampDateToRange', () => {
  it('should keep dates within 2000..2100 unchanged', () => {
    expect(clampDateToRange('2026-10-15')).toBe('2026-10-15');
    expect(clampDateToRange('2000-01-01')).toBe('2000-01-01');
    expect(clampDateToRange('2100-12-31')).toBe('2100-12-31');
  });

  it('should clamp dates earlier than 2000 to minYear', () => {
    expect(clampDateToRange('1990-05-12')).toBe('2000-05-12');
    expect(clampDateToRange('1800-01-01')).toBe('2000-01-01');
  });

  it('should clamp dates later than 2100 to maxYear', () => {
    expect(clampDateToRange('2150-08-20')).toBe('2100-08-20');
    expect(clampDateToRange('2999-12-31')).toBe('2100-12-31');
  });

  it('should clamp invalid leap day on non-leap year to Feb 28', () => {
    // 2025 is not a leap year, 2025-02-29 should clamp to 2025-02-28
    expect(clampDateToRange('2025-02-29')).toBe('2025-02-28');
    // 2024 is a leap year, 2024-02-29 is valid
    expect(clampDateToRange('2024-02-29')).toBe('2024-02-29');
  });

  it('should clamp days exceeding month max days', () => {
    // April has 30 days
    expect(clampDateToRange('2026-04-31')).toBe('2026-04-30');
  });

  it('should safely handle empty, null, undefined or garbage without returning Invalid Date', () => {
    const todayISO = formatDateToISO(new Date());
    expect(clampDateToRange(null)).toBe(todayISO);
    expect(clampDateToRange(undefined)).toBe(todayISO);
    expect(clampDateToRange('')).toBe(todayISO);
    expect(clampDateToRange('invalid-date')).toBe(todayISO);
  });
});

describe('dateUtils - createEventsByDateMap & createTasksByDateMap', () => {
  it('should group events by date accurately and handle multiple events per day', () => {
    const events: CalendarEvent[] = [
      { id: 'e1', title: 'Gym', date: '2026-10-01', time: '08:00', completed: false, status: 'upcoming' },
      { id: 'e2', title: 'Meeting', date: '2026-10-01', time: '11:00', completed: true, status: 'completed' },
      { id: 'e3', title: 'Study', date: '2026-10-05', time: '14:00', completed: false, status: 'upcoming' },
    ];

    const map = createEventsByDateMap(events);
    expect(map['2026-10-01']).toHaveLength(2);
    expect(map['2026-10-01'].map(e => e.id)).toEqual(['e1', 'e2']);
    expect(map['2026-10-05']).toHaveLength(1);
    expect(map['2026-10-05'][0].title).toBe('Study');
    expect(map['2026-10-02']).toBeUndefined();
  });

  it('should group tasks by canonical date using getTaskDate', () => {
    const tasks: TaskItem[] = [
      { id: 't1', title: 'Task Due', due_date: '2026-10-01', priority: 'high', status: 'pending', completed: false },
      { id: 't2', title: 'Task Date', date: '2026-10-01', priority: 'normal', status: 'completed', completed: true },
      { id: 't3', title: 'Task Overriding Date', due_date: '2026-10-02', date: '2026-10-01', priority: 'low', status: 'pending', completed: false },
      { id: 't4', title: 'Undated Task', priority: 'normal', status: 'pending', completed: false },
    ];

    const map = createTasksByDateMap(tasks);
    expect(map['2026-10-01']).toHaveLength(2);
    expect(map['2026-10-01'].map(t => t.id)).toEqual(['t1', 't2']);
    expect(map['2026-10-02']).toHaveLength(1);
    expect(map['2026-10-02'][0].id).toBe('t3');
    expect(map['2026-10-03']).toBeUndefined();
  });
});

