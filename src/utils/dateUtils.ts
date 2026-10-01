import { EventCategory, CalendarEvent, TaskItem } from '../types';

/**
 * Core Date & Time Architecture Conventions:
 * 1. Calendar Date: A pure "YYYY-MM-DD" string representing a local calendar date.
 *    Must NOT be parsed as a UTC instant (e.g., avoid `new Date("YYYY-MM-DD")` which uses UTC midnight).
 * 2. Local DateTime: Combining a Calendar Date and a 24-hour time "HH:mm" into a local Date object.
 * 3. UTC Timestamp: ISO 8601 string or epoch milliseconds used for sync, logs, and absolute reminders.
 */

export const EGYPT_TIMEZONE = 'Africa/Cairo';

export const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

/**
 * Validates whether a string is a strictly formatted YYYY-MM-DD calendar date.
 */
export const isCalendarDateString = (str: unknown): str is string => {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const [y, m, d] = trimmed.split('-').map(Number);
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const daysInM = getDaysInMonth(y, m - 1);
  return d <= daysInM;
};

/**
 * Safely parses a "YYYY-MM-DD" string into a local Date object at 00:00:00 local time.
 * Ignores any attached ISO time components to prevent UTC date shifting.
 * Falls back safely to current local midnight if input is malformed.
 */
export const parseCalendarDate = (dateStr: string): Date => {
  if (!dateStr || typeof dateStr !== 'string') {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const cleanStr = dateStr.trim().slice(0, 10);
  const parts = cleanStr.split('-').map(Number);

  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const year = parts[0];
    const month = Math.max(0, Math.min(11, parts[1] - 1));
    const maxDay = getDaysInMonth(year, month);
    const day = Math.max(1, Math.min(maxDay, parts[2]));
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * Alias for parseCalendarDate for backwards compatibility across existing components.
 */
export const parseDateString = parseCalendarDate;

/**
 * Formats a local Date object into a canonical "YYYY-MM-DD" calendar date string.
 * Uses local year, month, and day components to avoid UTC off-by-one errors.
 */
export const formatCalendarDate = (d: Date): string => {
  if (!d || isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Alias for formatCalendarDate for backwards compatibility across existing components.
 */
export const formatDateToISO = formatCalendarDate;

/**
 * Returns today's local calendar date string (YYYY-MM-DD).
 */
export const getTodayDateString = (): string => {
  return formatCalendarDate(new Date());
};

/**
 * Returns a calendar date string (YYYY-MM-DD) offset by a number of days relative to a base date or today.
 */
export const getRelativeDateString = (offsetDays: number, baseDateStr?: string): string => {
  const baseDate = baseDateStr ? parseCalendarDate(baseDateStr) : new Date();
  const target = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offsetDays);
  return formatCalendarDate(target);
};

/**
 * Combines a calendar date string (YYYY-MM-DD) and 24h time string (HH:mm) into a local Date object.
 */
export const combineDateAndTime = (dateStr: string, timeStr: string = '09:00'): Date => {
  const baseDate = parseCalendarDate(dateStr);
  const [hStr, mStr] = (timeStr || '09:00').trim().split(':');
  let hours = parseInt(hStr || '0', 10);
  let minutes = parseInt(mStr || '0', 10);
  if (isNaN(hours) || hours < 0 || hours > 23) hours = 0;
  if (isNaN(minutes) || minutes < 0 || minutes > 59) minutes = 0;
  baseDate.setHours(hours, minutes, 0, 0);
  return baseDate;
};

export const formatArabicFullDate = (dateStr: string): { dayName: string; formattedDate: string; isToday: boolean; isTomorrow: boolean; isYesterday: boolean } => {
  const d = parseDateString(dateStr);
  const now = new Date();
  
  const todayStr = formatDateToISO(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateToISO(tomorrow);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateToISO(yesterday);

  const dayName = ARABIC_DAYS[d.getDay()];
  const dayNum = d.getDate();
  const monthName = ARABIC_MONTHS[d.getMonth()];
  const formattedDate = `${dayName}، ${dayNum} ${monthName}`;

  return {
    dayName,
    formattedDate,
    isToday: dateStr === todayStr,
    isTomorrow: dateStr === tomorrowStr,
    isYesterday: dateStr === yesterdayStr,
  };
};

export const formatTime12h = (time24: string): string => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const suffix = h >= 12 ? 'م' : 'ص';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${suffix}`;
};

export const getCurrentTimeMinutes = (): number => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export const timeStringToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const formatDurationArabic = (startTime: string, endTime?: string): string => {
  if (!startTime || !endTime) return '';
  const startMin = timeStringToMinutes(startTime);
  const endMin = timeStringToMinutes(endTime);
  const diff = endMin - startMin;
  if (diff <= 0) return '';

  if (diff === 30) return 'نص ساعة';
  if (diff === 45) return '٤٥ دقيقة';
  if (diff === 60) return 'ساعة';
  if (diff === 90) return 'ساعة ونصف';
  if (diff === 120) return 'ساعتين';
  if (diff > 120 && diff % 60 === 0) return `${diff / 60} ساعات`;
  if (diff > 60) {
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `ساعة و ${mins} دقيقة`;
  }
  return `${diff} دقيقة`;
};

export const addOneHourToTime = (timeStr: string): string => {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h) || isNaN(m)) return '';
  const nextHour = (h + 1) % 24;
  return `${String(nextHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const suggestCategoryFromTitle = (title: string): EventCategory => {
  if (!title || typeof title !== 'string') return 'custom';
  const lower = title.toLowerCase().trim();
  if (lower.includes('جيم') || lower.includes('تمرين')) return 'workout';
  if (lower.includes('ميتينج') || lower.includes('اجتماع')) return 'meeting';
  if (lower.includes('محاضرة')) return 'lecture';
  if (lower.includes('سكشن')) return 'section';
  if (lower.includes('مذاكرة')) return 'study';
  return 'custom';
};

export const checkEventsTimeOverlap = (
  eventA: { time: string; endTime?: string },
  eventB: { time: string; endTime?: string }
): boolean => {
  if (!eventA || !eventB || !eventA.time || !eventB.time) return false;

  const parseInterval = (evt: { time: string; endTime?: string }): { start: number; end: number } | null => {
    if (typeof evt.time !== 'string' || !evt.time.trim()) return null;
    const [sh, sm] = evt.time.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm)) return null;
    const start = sh * 60 + sm;

    let end: number;
    if (
      evt.endTime !== undefined &&
      evt.endTime !== null &&
      typeof evt.endTime === 'string' &&
      evt.endTime.trim() !== ''
    ) {
      const [eh, em] = evt.endTime.split(':').map(Number);
      if (!isNaN(eh) && !isNaN(em)) {
        end = eh * 60 + em;
      } else {
        end = start + 60;
      }
    } else {
      // Default duration is 1 hour if no endTime
      end = start + 60;
    }

    return { start, end };
  };

  const a = parseInterval(eventA);
  const b = parseInterval(eventB);
  if (!a || !b) return false;

  return Math.max(a.start, b.start) < Math.min(a.end, b.end);
};

export const getEventStatus = (
  eventDate: string,
  startTime: string,
  endTime?: string,
  isCompleted?: boolean
): 'past' | 'current' | 'next' | 'later' => {
  if (isCompleted) return 'past';

  const todayStr = formatDateToISO(new Date());
  if (eventDate < todayStr) return 'past';
  if (eventDate > todayStr) return 'later';

  // For today:
  const nowMinutes = getCurrentTimeMinutes();
  const startMin = timeStringToMinutes(startTime);
  const endMin = timeStringToMinutes(endTime || startTime);

  // If current time falls inside the event window
  if (nowMinutes >= startMin && nowMinutes <= Math.max(endMin, startMin + 30)) {
    return 'current';
  }

  if (nowMinutes > Math.max(endMin, startMin + 30)) {
    return 'past';
  }

  // Upcoming
  if (startMin - nowMinutes <= 90 && startMin > nowMinutes) {
    return 'next';
  }

  return 'later';
};

export const getDayMoodMessage = (
  eventsCount: number,
  tasksCount: number,
  completedEvents: number,
  completedTasks: number
): { status: 'light' | 'busy' | 'very-busy' | 'done'; message: string; submessage: string } => {
  const total = eventsCount + tasksCount;
  const completedTotal = completedEvents + completedTasks;

  if (total > 0 && completedTotal >= total) {
    return {
      status: 'done',
      message: 'كده خلصنا 😌',
      submessage: 'يومك مشي على أكمل وجه، ارتاح واستمتع بوقتك.',
    };
  }

  if (eventsCount <= 2 && tasksCount <= 2) {
    return {
      status: 'light',
      message: 'النهارده رايق أوي 😌',
      submessage: 'وراك حاجات بسيطة وتقدر تاخد وقتك براحتك.',
    };
  }

  if (eventsCount >= 5 || total >= 8) {
    return {
      status: 'very-busy',
      message: 'النهارده مليان شوية ⚡️',
      submessage: 'خلينا نمشيها واحدة واحدة ومش هنزنق نفسنا.',
    };
  }

  return {
    status: 'busy',
    message: 'خد بالك 👀 النهارده زحمة شوية',
    submessage: 'رتب أولوياتك ونخلصهم سوا ورا بعض.',
  };
};

export const getWeekRange = (
  dateStr: string,
  weekStartsOn: 'saturday' | 'sunday' | 'monday' = 'saturday'
): { startDate: string; endDate: string } => {
  const d = parseDateString(dateStr);
  const day = d.getDay();
  let diff = 0;
  if (weekStartsOn === 'saturday') {
    diff = (day + 1) % 7;
  } else if (weekStartsOn === 'sunday') {
    diff = day;
  } else {
    diff = (day + 6) % 7;
  }
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    startDate: formatDateToISO(start),
    endDate: formatDateToISO(end),
  };
};

export const getMonthRange = (dateStr: string): { startDate: string; endDate: string } => {
  const d = parseDateString(dateStr);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    startDate: formatDateToISO(start),
    endDate: formatDateToISO(end),
  };
};

/**
 * Unified helper to get the canonical date of a task.
 * Evaluates t.due_date || t.date to guarantee a single source of truth across all views.
 */
export const getTaskDate = (task?: { due_date?: string | null; date?: string | null; [key: string]: any } | null): string => {
  if (!task) return '';
  return task.due_date || task.date || '';
};

/**
 * Checks if a Gregorian year is a leap year.
 */
export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

/**
 * Returns the exact count of days in a given month (0 = Jan, 11 = Dec).
 */
export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

/**
 * Clamps any date string or Date object within [minYear-01-01, maxYear-12-31].
 * Validates days against month boundaries including leap years.
 * Never produces Invalid Date.
 */
export const clampDateToRange = (
  dateInput: string | Date | null | undefined,
  minYear: number = 2000,
  maxYear: number = 2100
): string => {
  if (!dateInput) {
    return formatDateToISO(new Date());
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const parts = trimmed.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const year = Math.max(minYear, Math.min(maxYear, parts[0]));
      const month = Math.max(0, Math.min(11, parts[1] - 1));
      const maxDay = getDaysInMonth(year, month);
      const day = Math.max(1, Math.min(maxDay, parts[2]));
      return formatDateToISO(new Date(year, month, day));
    }
  }

  const d = typeof dateInput === 'string' ? parseDateString(dateInput) : new Date(dateInput);
  if (isNaN(d.getTime())) {
    return formatDateToISO(new Date());
  }

  const year = Math.max(minYear, Math.min(maxYear, d.getFullYear()));
  const month = d.getMonth();
  const maxDay = getDaysInMonth(year, month);
  const day = Math.max(1, Math.min(maxDay, d.getDate()));

  return formatDateToISO(new Date(year, month, day));
};

/**
 * High-performance indexing of events by date string (YYYY-MM-DD).
 */
export const createEventsByDateMap = (events: CalendarEvent[]): Record<string, CalendarEvent[]> => {
  const map: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    const d = e.date;
    if (!d) continue;
    if (!map[d]) {
      map[d] = [e];
    } else {
      map[d].push(e);
    }
  }
  return map;
};

/**
 * High-performance indexing of tasks by unified date string (YYYY-MM-DD) via getTaskDate.
 */
export const createTasksByDateMap = (tasks: TaskItem[]): Record<string, TaskItem[]> => {
  const map: Record<string, TaskItem[]> = {};
  for (const t of tasks) {
    const d = getTaskDate(t);
    if (!d) continue;
    if (!map[d]) {
      map[d] = [t];
    } else {
      map[d].push(t);
    }
  }
  return map;
};


