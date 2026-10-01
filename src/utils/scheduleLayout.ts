import { CalendarEvent, TaskItem, EventCategory } from '../types';
import {
  formatTime12h,
  getTaskDate,
  parseDateString,
  formatDateToISO,
  timeStringToMinutes,
} from './dateUtils';
import { CATEGORY_LABELS, ReportMetrics } from './reportUtils';
import { ExportIconType } from './exportIcons';

export type TextMeasureFn = (text: string, font: string) => number;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeaderLayout {
  bounds: Rect;
  logoBounds: Rect;
  title: string;
  titleFont: string;
  subtitle: string;
  subtitleFont: string;
  periodBadge: {
    bounds: Rect;
    text: string;
    font: string;
  };
}

export interface FooterLayout {
  bounds: Rect;
  text: string;
  font: string;
}

export interface SummaryCardLayout {
  bounds: Rect;
  title: string;
  value: string;
  subtitle?: string;
  iconType: ExportIconType;
  iconColor: string;
  valueColor: string;
}

export interface SummaryBarLayout {
  bounds: Rect;
  cards: SummaryCardLayout[];
}

export interface LegendItemLayout {
  category: EventCategory;
  label: string;
  color: string;
  bounds: Rect;
}

// ---------------------------------------------------------------------------
// 1. Week Layout Types
// ---------------------------------------------------------------------------

export interface EventItemWeekLayout {
  id: string;
  timeText: string;
  timeFont: string;
  categoryColor: string;
  titleLines: string[];
  titleFont: string;
  locationText?: string;
  locationFont?: string;
  isCompleted: boolean;
  bounds: Rect;
}

export interface TaskItemWeekLayout {
  id: string;
  titleLines: string[];
  titleFont: string;
  dueTimeText?: string;
  isCompleted: boolean;
  bounds: Rect;
}

export interface WeekDayRowLayout {
  dateStr: string;
  dayName: string;
  dateNumberText: string;
  isToday: boolean;
  isEmpty: boolean;
  cardBounds: Rect;
  dayColumnBounds: Rect;
  events: EventItemWeekLayout[];
  tasks: TaskItemWeekLayout[];
}

export interface WeekScheduleLayout {
  type: 'week';
  width: number;
  height: number;
  header: HeaderLayout;
  summary: SummaryBarLayout;
  days: WeekDayRowLayout[];
  footer: FooterLayout;
}

// ---------------------------------------------------------------------------
// 2. Month Layout Types
// ---------------------------------------------------------------------------

export interface MonthCellItem {
  id: string;
  type: 'event' | 'task';
  categoryColor?: string;
  timeText?: string;
  titleLines: string[];
  isCompleted: boolean;
  bounds: Rect;
}

export interface MonthCellLayout {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  bounds: Rect;
  items: MonthCellItem[];
}

export interface MonthWeekRowLayout {
  bounds: Rect;
  cells: MonthCellLayout[];
}

export interface MonthScheduleLayout {
  type: 'month';
  width: number;
  height: number;
  header: HeaderLayout;
  summary: SummaryBarLayout;
  weekdayHeader: {
    bounds: Rect;
    days: Array<{ text: string; bounds: Rect }>;
  };
  weeks: MonthWeekRowLayout[];
  legend?: {
    bounds: Rect;
    items: LegendItemLayout[];
  };
  footer: FooterLayout;
}

// ---------------------------------------------------------------------------
// 3. Timetable Layout Types (جدول المحاضرات 2000px - 3200px)
// ---------------------------------------------------------------------------

export interface TimetableEventBlock {
  id: string;
  titleLines: string[];
  timeText: string;
  locationText?: string;
  category: EventCategory;
  categoryColor: string;
  isCompleted: boolean;
  bounds: Rect;
}

export interface TimetableDayRow {
  dateStr: string;
  dayName: string;
  dateFormatted: string;
  isToday: boolean;
  bounds: Rect;
  lanesCount: number;
  events: TimetableEventBlock[];
}

export interface TimetableHourMark {
  hour24: number;
  label: string;
  x: number;
}

export interface TimetableScheduleLayout {
  type: 'timetable';
  width: number;
  height: number;
  header: HeaderLayout;
  isEmpty: boolean;
  emptyMessage?: string;
  gridBounds: Rect;
  dayColumnBounds: Rect;
  startHour: number;
  endHour: number;
  pxPerHour: number;
  hourMarks: TimetableHourMark[];
  days: TimetableDayRow[];
  legend?: {
    bounds: Rect;
    items: LegendItemLayout[];
  };
  footer: FooterLayout;
}

// ---------------------------------------------------------------------------
// 4. Story Layout Types (جدول اليوم - ستوري 1080x1920)
// ---------------------------------------------------------------------------

export interface StoryTimelineItem {
  id: string;
  type: 'event' | 'task';
  titleLines: string[];
  timeText: string;
  category?: EventCategory;
  categoryLabel?: string;
  categoryColor: string;
  locationText?: string;
  isCompleted: boolean;
  nodeY: number;
  cardBounds: Rect;
}

export interface StoryPageLayout {
  pageIndex: number;
  totalPages: number;
  items: StoryTimelineItem[];
  hasEvents: boolean;
  hasTasks: boolean;
}

export interface StoryScheduleLayout {
  type: 'story';
  width: number;
  height: number;
  dateStr: string;
  dayName: string;
  dateFormatted: string;
  statsText: string;
  header: HeaderLayout;
  isEmpty: boolean;
  emptyMessage?: string;
  pages: StoryPageLayout[];
  footer: FooterLayout;
}

// ---------------------------------------------------------------------------
// 5. Courses Layout Types (جدول المواد 1080px)
// ---------------------------------------------------------------------------

export interface CourseEventItem {
  id: string;
  dayName: string;
  dateStr: string;
  timeFormatted: string;
  locationText?: string;
  category: EventCategory;
  categoryLabel: string;
  categoryColor: string;
  isCompleted: boolean;
  bounds: Rect;
}

export interface CourseCardLayout {
  courseName: string;
  instructor?: string;
  accentColor: string;
  events: CourseEventItem[];
  bounds: Rect;
}

export interface CoursesScheduleLayout {
  type: 'courses';
  width: number;
  height: number;
  header: HeaderLayout;
  hasNoCourses: boolean;
  emptyMessage?: string;
  courses: CourseCardLayout[];
  footer: FooterLayout;
}

// ---------------------------------------------------------------------------
// 6. Upcoming Layout Types (اللي قدامك 14 يوم 1080px)
// ---------------------------------------------------------------------------

export interface UpcomingItemRow {
  id: string;
  type: 'event' | 'task';
  titleLines: string[];
  timeOrDueText: string;
  category?: EventCategory;
  categoryColor: string;
  iconType: ExportIconType;
  relativeDaysBadge: string;
  isOverdue?: boolean;
  isCompleted: boolean;
  bounds: Rect;
}

export interface UpcomingDayGroup {
  dateStr: string;
  title: string;
  subtitle?: string;
  isOverdueGroup?: boolean;
  items: UpcomingItemRow[];
  bounds: Rect;
}

export interface UpcomingScheduleLayout {
  type: 'upcoming';
  width: number;
  height: number;
  header: HeaderLayout;
  isEmpty: boolean;
  emptyMessage?: string;
  groups: UpcomingDayGroup[];
  footer: FooterLayout;
}

// ---------------------------------------------------------------------------
// 7. Summary Layout Types (ملخص الإنجاز 1080px)
// ---------------------------------------------------------------------------

export interface CategoryBarItem {
  category: EventCategory;
  label: string;
  count: number;
  percentage: number;
  color: string;
  bounds: Rect;
}

export interface DailyActivityBar {
  label: string;
  sublabel: string;
  count: number;
  isBusiest: boolean;
  barHeight: number;
  bounds: Rect;
}

export interface SummaryScheduleLayout {
  type: 'summary';
  width: number;
  height: number;
  header: HeaderLayout;
  isEmpty: boolean;
  emptyMessage?: string;
  progressCard: {
    bounds: Rect;
    completionRate: number;
    title: string;
    subtitle: string;
  };
  statCards: SummaryCardLayout[];
  categoryBarsCard: {
    bounds: Rect;
    title: string;
    bars: CategoryBarItem[];
  };
  busiestCard: {
    bounds: Rect;
    title: string;
    dayName: string;
    dateFormatted: string;
    eventCount: number;
  };
  activityChartCard: {
    bounds: Rect;
    title: string;
    bars: DailyActivityBar[];
  };
  footer: FooterLayout;
}

export type AnyScheduleLayout =
  | WeekScheduleLayout
  | MonthScheduleLayout
  | TimetableScheduleLayout
  | StoryScheduleLayout
  | CoursesScheduleLayout
  | UpcomingScheduleLayout
  | SummaryScheduleLayout;

// Theme Colors
export const THEME = {
  bg: '#F6F3EE',
  cardBg: '#FFFFFF',
  cardBorder: '#E4DED4',
  primary: '#243B35',
  accent: '#C58B5C',
  sage: '#6F8F78',
  text: '#242522',
  textSecondary: '#77766F',
  textMuted: '#A3A198',
  warningBg: '#FDF2F0',
  warningBorder: '#EFC7C2',
  warningText: '#B86B61',
  dimmedCellBg: '#EFEBE4',
  badgeBg: '#EAE3D5',
};

// Fixed Category Colors
export const CATEGORY_COLORS: Record<EventCategory, string> = {
  lecture: '#2E6B56',
  section: '#35657E',
  meeting: '#C58B5C',
  workout: '#D97736',
  study: '#6F8F78',
  personal: '#8E5D87',
  custom: '#64748B',
};

export const ARABIC_WEEKDAYS = [
  'السبت',
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];

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
 * Pure word-wrapping function that splits text into up to `maxLines` lines based on measured width.
 */
export function wrapText(
  text: string,
  font: string,
  maxWidth: number,
  measureText: TextMeasureFn,
  maxLines = 3
): string[] {
  if (!text || maxWidth <= 0) return [''];
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = `${currentLine} ${word}`;
    const w = measureText(testLine, font);

    if (w <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      if (lines.length >= maxLines - 1) {
        const rest = words.slice(i).join(' ');
        currentLine = rest;
        break;
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    let finalLine = currentLine;
    while (finalLine.length > 3 && measureText(`${finalLine}…`, font) > maxWidth) {
      finalLine = finalLine.slice(0, -1);
    }
    if (finalLine !== currentLine) {
      lines.push(`${finalLine}…`);
    } else {
      lines.push(finalLine);
    }
  }

  return lines.slice(0, maxLines);
}

/**
 * Helper to build standard unified header layout.
 */
export function buildUnifiedHeaderLayout(options: {
  width: number;
  title: string;
  subtitle: string;
  periodText: string;
  measureText: TextMeasureFn;
}): { header: HeaderLayout; nextY: number } {
  const marginX = options.width >= 1800 ? 60 : 48;
  const contentWidth = options.width - 2 * marginX;
  const startY = 48;

  const titleFont = '700 36px Tajawal';
  const subtitleFont = '500 20px Tajawal';
  const badgeFont = '700 18px Tajawal';

  const badgeTextWidth = options.measureText(options.periodText, badgeFont);
  const badgeWidth = Math.max(160, badgeTextWidth + 40);
  const badgeHeight = 44;

  const badgeBounds: Rect = {
    x: marginX,
    y: startY + 6,
    width: badgeWidth,
    height: badgeHeight,
  };

  const logoSize = 56;
  const logoBounds: Rect = {
    x: marginX + contentWidth - logoSize,
    y: startY,
    width: logoSize,
    height: logoSize,
  };

  const header: HeaderLayout = {
    bounds: { x: marginX, y: startY, width: contentWidth, height: 72 },
    logoBounds,
    title: options.title,
    titleFont,
    subtitle: options.subtitle,
    subtitleFont,
    periodBadge: {
      bounds: badgeBounds,
      text: options.periodText,
      font: badgeFont,
    },
  };

  return { header, nextY: startY + 72 + 28 };
}

/**
 * Helper to build standard unified footer layout.
 */
export function buildUnifiedFooterLayout(options: {
  width: number;
  currentY: number;
}): { footer: FooterLayout; finalHeight: number } {
  const marginX = options.width >= 1800 ? 60 : 48;
  const contentWidth = options.width - 2 * marginX;
  const footerH = 32;
  const bottomPadding = 44;

  const footer: FooterLayout = {
    bounds: { x: marginX, y: options.currentY, width: contentWidth, height: footerH },
    text: 'ازبطها · صاحب يومك',
    font: '500 20px Tajawal',
  };

  return { footer, finalHeight: options.currentY + footerH + bottomPadding };
}

/**
 * Helper for Arabic dual/plural countdown grammar.
 */
export function formatArabicDaysRemaining(diffDays: number): string {
  if (diffDays === 0) return 'النهارده';
  if (diffDays === 1) return 'بكرة';
  if (diffDays === 2) return 'بعد يومين';
  if (diffDays >= 3 && diffDays <= 10) return `بعد ${diffDays} أيام`;
  return `بعد ${diffDays} يوم`;
}

export function formatArabicOverdueText(overdueDays: number): string {
  if (overdueDays === 1) return 'متأخرة من إمبارح';
  if (overdueDays === 2) return 'متأخرة من يومين';
  if (overdueDays >= 3 && overdueDays <= 10) return `متأخرة من ${overdueDays} أيام`;
  return `متأخرة من ${overdueDays} يوم`;
}

// ---------------------------------------------------------------------------
// 1. Week Layout Builder
// ---------------------------------------------------------------------------

export function buildWeekLayout(
  data: {
    startDateStr: string;
    endDateStr: string;
    rangeFormatted: string;
    periodName?: string;
    todayStr: string;
    days: Array<{
      date: string;
      dayName: string;
      dayNumber: number;
      monthName?: string;
      events: CalendarEvent[];
      tasks: TaskItem[];
    }>;
    metrics: {
      totalEvents: number;
      completedEvents: number;
      totalTasks: number;
      completedTasks: number;
      completionRate: number;
    };
  },
  measureText: TextMeasureFn
): WeekScheduleLayout {
  const CANVAS_WIDTH = 1080;
  const MARGIN_X = 48;
  const CONTENT_WIDTH = CANVAS_WIDTH - 2 * MARGIN_X;

  const { header, nextY } = buildUnifiedHeaderLayout({
    width: CANVAS_WIDTH,
    title: 'جدول الأسبوع',
    subtitle: 'مواعيدك ومهماتك الأسبوعية',
    periodText: data.rangeFormatted || `${data.startDateStr} – ${data.endDateStr}`,
    measureText,
  });

  let currentY = nextY;

  // Summary Cards
  const cardGap = 16;
  const cardW = (CONTENT_WIDTH - 2 * cardGap) / 3;
  const cardH = 88;

  const summaryCards: SummaryCardLayout[] = [
    {
      bounds: { x: MARGIN_X + 2 * (cardW + cardGap), y: currentY, width: cardW, height: cardH },
      title: 'المواعيد',
      value: `${data.metrics.totalEvents}`,
      subtitle: `${data.metrics.completedEvents} خلصت`,
      iconType: 'calendar',
      iconColor: THEME.primary,
      valueColor: THEME.primary,
    },
    {
      bounds: { x: MARGIN_X + (cardW + cardGap), y: currentY, width: cardW, height: cardH },
      title: 'المهام',
      value: `${data.metrics.totalTasks}`,
      subtitle: `${data.metrics.completedTasks} مكتملة`,
      iconType: 'task',
      iconColor: THEME.accent,
      valueColor: THEME.accent,
    },
    {
      bounds: { x: MARGIN_X, y: currentY, width: cardW, height: cardH },
      title: 'نسبة الإنجاز',
      value: `${data.metrics.completionRate}%`,
      subtitle: data.metrics.completionRate >= 80 ? 'عاش جداً!' : 'كمّل يا بطل',
      iconType: 'checkCircle',
      iconColor: THEME.sage,
      valueColor: THEME.sage,
    },
  ];

  const summary: SummaryBarLayout = {
    bounds: { x: MARGIN_X, y: currentY, width: CONTENT_WIDTH, height: cardH },
    cards: summaryCards,
  };

  currentY += cardH + 28;

  const DAY_COL_WIDTH = 170;
  const CONTENT_COL_WIDTH = CONTENT_WIDTH - DAY_COL_WIDTH - 32;

  const daysLayout: WeekDayRowLayout[] = [];

  for (const day of data.days) {
    const hasEvents = day.events.length > 0;
    const hasTasks = day.tasks.length > 0;
    const isToday = day.date === data.todayStr;
    const isEmpty = !hasEvents && !hasTasks;

    const rowStartY = currentY;
    let itemY = rowStartY + 24;

    const eventsLayout: EventItemWeekLayout[] = [];
    const tasksLayout: TaskItemWeekLayout[] = [];

    const itemContentWidth = CONTENT_COL_WIDTH - 160 - 32;

    for (const evt of day.events) {
      const timeStart = evt.time || evt.start_time || '09:00';
      const timeEnd = evt.endTime || evt.end_time;
      const timeFormatted = timeEnd
        ? `${formatTime12h(timeStart)} – ${formatTime12h(timeEnd)}`
        : formatTime12h(timeStart);

      const titleFont = '700 22px Tajawal';
      const titleLines = wrapText(evt.title, titleFont, itemContentWidth, measureText, 3);
      const titleHeight = titleLines.length * 28;

      let locationText: string | undefined;
      const instructor = evt.doctor_or_ta || evt.instructor;
      const parts: string[] = [];
      if (evt.course) parts.push(evt.course);
      if (instructor) parts.push(instructor);
      if (evt.location) parts.push(evt.location);
      if (parts.length > 0) locationText = parts.join(' • ');

      const locHeight = locationText ? 24 : 0;
      const eventItemHeight = Math.max(48, titleHeight + locHeight + 12);

      eventsLayout.push({
        id: evt.id,
        timeText: timeFormatted,
        timeFont: '600 20px Tajawal',
        categoryColor: CATEGORY_COLORS[evt.category || 'custom'] || THEME.primary,
        titleLines,
        titleFont,
        locationText,
        locationFont: '500 18px Tajawal',
        isCompleted: Boolean(evt.completed || evt.status === 'completed'),
        bounds: {
          x: MARGIN_X + 24,
          y: itemY,
          width: CONTENT_COL_WIDTH,
          height: eventItemHeight,
        },
      });

      itemY += eventItemHeight + 12;
    }

    if (hasTasks) {
      itemY += 6;
      for (const t of day.tasks) {
        const titleFont = '500 20px Tajawal';
        const taskTitleWidth = CONTENT_COL_WIDTH - 48;
        const titleLines = wrapText(t.title, titleFont, taskTitleWidth, measureText, 2);
        const taskItemHeight = Math.max(36, titleLines.length * 26 + 8);

        tasksLayout.push({
          id: t.id,
          titleLines,
          titleFont,
          dueTimeText: t.due_time ? formatTime12h(t.due_time) : undefined,
          isCompleted: Boolean(t.completed || t.status === 'completed'),
          bounds: {
            x: MARGIN_X + 24,
            y: itemY,
            width: CONTENT_COL_WIDTH,
            height: taskItemHeight,
          },
        });

        itemY += taskItemHeight + 8;
      }
    }

    const calculatedHeight = isEmpty ? 88 : Math.max(88, itemY - rowStartY + 16);

    const cardBounds: Rect = {
      x: MARGIN_X,
      y: rowStartY,
      width: CONTENT_WIDTH,
      height: calculatedHeight,
    };

    const dayColumnBounds: Rect = {
      x: MARGIN_X + CONTENT_WIDTH - DAY_COL_WIDTH,
      y: rowStartY,
      width: DAY_COL_WIDTH,
      height: calculatedHeight,
    };

    daysLayout.push({
      dateStr: day.date,
      dayName: day.dayName,
      dateNumberText: `${day.dayNumber} ${day.monthName || ''}`.trim(),
      isToday,
      isEmpty,
      cardBounds,
      dayColumnBounds,
      events: eventsLayout,
      tasks: tasksLayout,
    });

    currentY += calculatedHeight + 16;
  }

  currentY += 12;

  const { footer, finalHeight } = buildUnifiedFooterLayout({
    width: CANVAS_WIDTH,
    currentY,
  });

  return {
    type: 'week',
    width: CANVAS_WIDTH,
    height: finalHeight,
    header,
    summary,
    days: daysLayout,
    footer,
  };
}

// ---------------------------------------------------------------------------
// 2. Month Layout Builder
// ---------------------------------------------------------------------------

export function buildMonthLayout(
  data: {
    monthName: string;
    year: number;
    monthDateStr: string;
    todayStr: string;
    gridDays: Array<{
      date: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: CalendarEvent[];
      tasks: TaskItem[];
    }>;
    metrics: {
      totalEvents: number;
      completedEvents: number;
      totalTasks: number;
      completedTasks: number;
      completionRate: number;
    };
  },
  measureText: TextMeasureFn
): MonthScheduleLayout {
  const CANVAS_WIDTH = 1080;
  const MARGIN_X = 48;
  const CONTENT_WIDTH = CANVAS_WIDTH - 2 * MARGIN_X;

  const { header, nextY } = buildUnifiedHeaderLayout({
    width: CANVAS_WIDTH,
    title: 'الجدول الشهري',
    subtitle: 'نظرة شاملة على الشهر',
    periodText: `${data.monthName} ${data.year}`,
    measureText,
  });

  let currentY = nextY;

  const cardGap = 16;
  const cardW = (CONTENT_WIDTH - 2 * cardGap) / 3;
  const cardH = 88;

  const summaryCards: SummaryCardLayout[] = [
    {
      bounds: { x: MARGIN_X + 2 * (cardW + cardGap), y: currentY, width: cardW, height: cardH },
      title: 'إجمالي المواعيد',
      value: `${data.metrics.totalEvents}`,
      subtitle: `${data.metrics.completedEvents} خلصت`,
      iconType: 'calendar',
      iconColor: THEME.primary,
      valueColor: THEME.primary,
    },
    {
      bounds: { x: MARGIN_X + (cardW + cardGap), y: currentY, width: cardW, height: cardH },
      title: 'إجمالي المهام',
      value: `${data.metrics.totalTasks}`,
      subtitle: `${data.metrics.completedTasks} مكتملة`,
      iconType: 'task',
      iconColor: THEME.accent,
      valueColor: THEME.accent,
    },
    {
      bounds: { x: MARGIN_X, y: currentY, width: cardW, height: cardH },
      title: 'نسبة الإنجاز',
      value: `${data.metrics.completionRate}%`,
      subtitle: 'خلال الشهر',
      iconType: 'checkCircle',
      iconColor: THEME.sage,
      valueColor: THEME.sage,
    },
  ];

  const summary: SummaryBarLayout = {
    bounds: { x: MARGIN_X, y: currentY, width: CONTENT_WIDTH, height: cardH },
    cards: summaryCards,
  };

  currentY += cardH + 28;

  const weekdayHeaderHeight = 44;
  const colWidth = CONTENT_WIDTH / 7;

  const weekdayCols = ARABIC_WEEKDAYS.map((dayName, idx) => ({
    text: dayName,
    bounds: {
      x: MARGIN_X + (6 - idx) * colWidth,
      y: currentY,
      width: colWidth,
      height: weekdayHeaderHeight,
    },
  }));

  const weekdayHeader = {
    bounds: { x: MARGIN_X, y: currentY, width: CONTENT_WIDTH, height: weekdayHeaderHeight },
    days: weekdayCols,
  };

  currentY += weekdayHeaderHeight + 8;

  const weeksLayout: MonthWeekRowLayout[] = [];
  const usedCategories = new Set<EventCategory>();

  const totalDays = data.gridDays.length;
  const numWeeks = Math.ceil(totalDays / 7);

  for (let wIdx = 0; wIdx < numWeeks; wIdx++) {
    const weekDays = data.gridDays.slice(wIdx * 7, (wIdx + 1) * 7);
    const weekStartY = currentY;

    const cellItemsMap: MonthCellItem[][] = [];
    const cellHeights: number[] = [];

    for (let cIdx = 0; cIdx < weekDays.length; cIdx++) {
      const d = weekDays[cIdx];
      const items: MonthCellItem[] = [];
      let cellContentHeight = 42;

      if (d.isCurrentMonth) {
        const itemWidth = colWidth - 16;

        for (const evt of d.events) {
          const cat = evt.category || 'custom';
          usedCategories.add(cat);
          const timeStr = evt.time || evt.start_time;
          const timeText = timeStr ? formatTime12h(timeStr) : undefined;
          const titleFont = '700 19px Tajawal';
          const titleLines = wrapText(
            evt.title,
            titleFont,
            itemWidth - (timeText ? 24 : 12),
            measureText,
            3
          );
          const itemH = Math.max(34, titleLines.length * 24 + 10);

          items.push({
            id: evt.id,
            type: 'event',
            categoryColor: CATEGORY_COLORS[cat] || THEME.primary,
            timeText,
            titleLines,
            isCompleted: Boolean(evt.completed || evt.status === 'completed'),
            bounds: { x: 0, y: cellContentHeight, width: itemWidth, height: itemH },
          });

          cellContentHeight += itemH + 6;
        }

        for (const t of d.tasks) {
          const titleFont = '500 17px Tajawal';
          const titleLines = wrapText(t.title, titleFont, itemWidth - 22, measureText, 2);
          const itemH = Math.max(26, titleLines.length * 22 + 6);

          items.push({
            id: t.id,
            type: 'task',
            titleLines,
            isCompleted: Boolean(t.completed || t.status === 'completed'),
            bounds: { x: 0, y: cellContentHeight, width: itemWidth, height: itemH },
          });

          cellContentHeight += itemH + 6;
        }
      }

      cellItemsMap.push(items);
      cellHeights.push(Math.max(150, cellContentHeight + 16));
    }

    const rowHeight = Math.max(150, ...cellHeights);
    const rowCells: MonthCellLayout[] = [];

    for (let cIdx = 0; cIdx < weekDays.length; cIdx++) {
      const d = weekDays[cIdx];
      const cellX = MARGIN_X + (6 - cIdx) * colWidth;
      const cellBounds: Rect = { x: cellX, y: weekStartY, width: colWidth, height: rowHeight };

      const adjustedItems = cellItemsMap[cIdx].map((it) => ({
        ...it,
        bounds: {
          x: cellX + 8,
          y: weekStartY + it.bounds.y,
          width: colWidth - 16,
          height: it.bounds.height,
        },
      }));

      rowCells.push({
        dateStr: d.date,
        dayNumber: d.dayNumber,
        isCurrentMonth: d.isCurrentMonth,
        isToday: d.isToday,
        bounds: cellBounds,
        items: adjustedItems,
      });
    }

    weeksLayout.push({
      bounds: { x: MARGIN_X, y: weekStartY, width: CONTENT_WIDTH, height: rowHeight },
      cells: rowCells,
    });

    currentY += rowHeight;
  }

  currentY += 24;

  let legend: { bounds: Rect; items: LegendItemLayout[] } | undefined;
  if (usedCategories.size > 0) {
    const legendH = 56;
    const legendBounds: Rect = { x: MARGIN_X, y: currentY, width: CONTENT_WIDTH, height: legendH };
    const legendItemsList: LegendItemLayout[] = [];

    const categoriesArray = Array.from(usedCategories);
    let itemX = MARGIN_X + CONTENT_WIDTH - 24;

    for (const cat of categoriesArray) {
      const label = CATEGORY_LABELS[cat] || cat;
      const font = '600 18px Tajawal';
      const labelW = measureText(label, font);
      const totalItemW = labelW + 28;

      itemX -= totalItemW;
      legendItemsList.push({
        category: cat,
        label,
        color: CATEGORY_COLORS[cat] || THEME.primary,
        bounds: { x: itemX, y: currentY + 14, width: totalItemW, height: 28 },
      });
      itemX -= 20;
    }

    legend = {
      bounds: legendBounds,
      items: legendItemsList,
    };

    currentY += legendH + 24;
  }

  const { footer, finalHeight } = buildUnifiedFooterLayout({
    width: CANVAS_WIDTH,
    currentY,
  });

  return {
    type: 'month',
    width: CANVAS_WIDTH,
    height: finalHeight,
    header,
    summary,
    weekdayHeader,
    weeks: weeksLayout,
    legend,
    footer,
  };
}

// ---------------------------------------------------------------------------
// 3. Timetable Layout Builder (جدول المحاضرات 2000px - 3200px)
// ---------------------------------------------------------------------------

export function buildTimetableLayout(
  data: {
    startDateStr: string;
    endDateStr: string;
    rangeFormatted: string;
    todayStr: string;
    events: CalendarEvent[];
  },
  measureText: TextMeasureFn
): TimetableScheduleLayout {
  const BASE_WIDTH = 2000;
  const MARGIN_X = 60;
  const DAY_COL_WIDTH = 200;

  // 1. Group events by date (Saturday to Friday)
  const startD = parseDateString(data.startDateStr);
  const daysList: Array<{ dateStr: string; dayName: string; dayIndex: number }> = [];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(startD);
    cur.setDate(startD.getDate() + i);
    const dateStr = formatDateToISO(cur);
    const dayIndex = cur.getDay(); // 6 = Sat, 0 = Sun, etc.
    const arabicName = ARABIC_WEEKDAYS[(dayIndex + 1) % 7];
    daysList.push({ dateStr, dayName: arabicName, dayIndex });
  }

  // Filter out Friday (الجمعة) if it has zero events
  const fridayStr = daysList[6]?.dateStr;
  const fridayEvents = fridayStr
    ? data.events.filter((e) => e.date === fridayStr && !(e as any).deleted)
    : [];
  const activeDays = fridayEvents.length > 0 ? daysList : daysList.slice(0, 6);

  const nonDeletedEvents = data.events.filter((e) => !(e as any).deleted);
  const isEmpty = nonDeletedEvents.length === 0;

  // 2. Compute hour range across all events
  let earliestMinute = 8 * 60; // 08:00
  let latestMinute = 16 * 60; // 16:00
  let shortestDurationMin = 60;

  for (const evt of nonDeletedEvents) {
    const sMin = timeStringToMinutes(evt.time || evt.start_time || '09:00');
    let eMin = evt.endTime || evt.end_time
      ? timeStringToMinutes(evt.endTime || evt.end_time!)
      : sMin + 60;

    // Handle overnight events (endTime < time) -> treat as 23:59 (1439 min)
    if (eMin <= sMin) {
      eMin = 24 * 60;
    }

    if (sMin < earliestMinute) earliestMinute = sMin;
    if (eMin > latestMinute) latestMinute = eMin;

    const dur = Math.max(15, eMin - sMin);
    if (dur < shortestDurationMin) shortestDurationMin = dur;
  }

  const startHour = Math.max(0, Math.floor(earliestMinute / 60));
  const endHour = Math.min(24, Math.ceil(latestMinute / 60));
  const totalHours = Math.max(8, endHour - startHour);

  // 3. Dynamic width calculation so narrowest block >= 150px
  let availableGridWidth = BASE_WIDTH - 2 * MARGIN_X - DAY_COL_WIDTH;
  let pxPerHour = availableGridWidth / totalHours;
  const narrowestBlockPx = (shortestDurationMin / 60) * pxPerHour;

  let canvasWidth = BASE_WIDTH;
  if (narrowestBlockPx < 150) {
    const desiredPxPerHour = 150 / (shortestDurationMin / 60);
    const desiredWidth = 2 * MARGIN_X + DAY_COL_WIDTH + totalHours * desiredPxPerHour;
    canvasWidth = Math.min(3200, Math.max(2000, Math.round(desiredWidth)));
    availableGridWidth = canvasWidth - 2 * MARGIN_X - DAY_COL_WIDTH;
    pxPerHour = availableGridWidth / totalHours;
  }

  const contentWidth = canvasWidth - 2 * MARGIN_X;

  const { header, nextY } = buildUnifiedHeaderLayout({
    width: canvasWidth,
    title: 'جدول المحاضرات والسكاشن',
    subtitle: 'الجدول الدراسي الأسبوعي المنظم',
    periodText: data.rangeFormatted || `${data.startDateStr} – ${data.endDateStr}`,
    measureText,
  });

  let currentY = nextY;

  // Grid coordinates:
  // RTL: The Day column is on the RIGHT.
  // X for Day Column = MARGIN_X + availableGridWidth
  // X for Grid = MARGIN_X to MARGIN_X + availableGridWidth
  // In RTL, Start hour is on the right (at MARGIN_X + availableGridWidth)
  // End hour is on the left (at MARGIN_X)
  const gridRightX = MARGIN_X + availableGridWidth;
  const dayColX = gridRightX;

  const gridHeaderHeight = 44;
  const gridBounds: Rect = {
    x: MARGIN_X,
    y: currentY,
    width: availableGridWidth,
    height: 0, // calculated later
  };

  const dayColumnBounds: Rect = {
    x: dayColX,
    y: currentY,
    width: DAY_COL_WIDTH,
    height: 0, // calculated later
  };

  // Hour Marks
  const hourMarks: TimetableHourMark[] = [];
  for (let h = startHour; h <= endHour; h++) {
    const label = formatTime12h(`${String(h).padStart(2, '0')}:00`);
    const hourOffset = h - startHour;
    // RTL: 0 offset is at gridRightX, increasing offset moves left
    const x = gridRightX - hourOffset * pxPerHour;
    hourMarks.push({ hour24: h, label, x });
  }

  currentY += gridHeaderHeight;

  // 4. Lay out each day row and partition overlapping events into non-overlapping lanes
  const daysLayout: TimetableDayRow[] = [];
  const usedCategories = new Set<EventCategory>();
  const LANE_HEIGHT = 80;
  const LANE_GAP = 8;
  const ROW_PADDING = 12;

  for (const day of activeDays) {
    const dayEvts = data.events.filter(
      (e) => e.date === day.dateStr && !(e as any).deleted
    );

    // Sort events chronologically
    dayEvts.sort((a, b) => {
      const aMin = timeStringToMinutes(a.time || a.start_time || '09:00');
      const bMin = timeStringToMinutes(b.time || b.start_time || '09:00');
      return aMin - bMin;
    });

    // Greedy lane assignment
    const lanes: Array<Array<{ evt: CalendarEvent; startMin: number; endMin: number }>> = [];

    for (const evt of dayEvts) {
      const sMin = timeStringToMinutes(evt.time || evt.start_time || '09:00');
      let eMin = evt.endTime || evt.end_time
        ? timeStringToMinutes(evt.endTime || evt.end_time!)
        : sMin + 60;
      if (eMin <= sMin) eMin = 24 * 60;

      let placed = false;
      for (let l = 0; l < lanes.length; l++) {
        const lastInLane = lanes[l][lanes[l].length - 1];
        if (lastInLane.endMin <= sMin) {
          lanes[l].push({ evt, startMin: sMin, endMin: eMin });
          placed = true;
          break;
        }
      }
      if (!placed) {
        lanes.push([{ evt, startMin: sMin, endMin: eMin }]);
      }
    }

    const lanesCount = Math.max(1, lanes.length);
    const rowHeight = ROW_PADDING * 2 + lanesCount * LANE_HEIGHT + (lanesCount - 1) * LANE_GAP;
    const rowStartY = currentY;

    const eventBlocks: TimetableEventBlock[] = [];

    for (let l = 0; l < lanes.length; l++) {
      for (const item of lanes[l]) {
        const { evt, startMin, endMin } = item;
        const cat = evt.category || 'lecture';
        usedCategories.add(cat);

        // Fractional hours from startHour
        const startFraction = Math.max(0, startMin / 60 - startHour);
        const endFraction = Math.min(totalHours, endMin / 60 - startHour);

        // In RTL: startMin is on right, endMin is on left
        const rightEdge = gridRightX - startFraction * pxPerHour;
        const leftEdge = gridRightX - endFraction * pxPerHour;
        const blockW = Math.max(40, rightEdge - leftEdge);
        const blockX = leftEdge;
        const blockY = rowStartY + ROW_PADDING + l * (LANE_HEIGHT + LANE_GAP);

        const timeStartStr = evt.time || evt.start_time || '09:00';
        const timeEndStr = evt.endTime || evt.end_time;
        const timeText = timeEndStr
          ? `${formatTime12h(timeStartStr)} – ${formatTime12h(timeEndStr)}`
          : formatTime12h(timeStartStr);

        let locationText = evt.location?.trim();
        const instructor = (evt.doctor_or_ta || evt.instructor)?.trim();
        if (instructor) {
          locationText = locationText ? `${instructor} • ${locationText}` : instructor;
        }

        const titleFont = '700 20px Tajawal';
        const titleLines = wrapText(evt.title, titleFont, blockW - 24, measureText, 2);

        eventBlocks.push({
          id: evt.id,
          titleLines,
          timeText,
          locationText,
          category: cat,
          categoryColor: CATEGORY_COLORS[cat] || THEME.primary,
          isCompleted: Boolean(evt.completed || evt.status === 'completed'),
          bounds: { x: blockX + 2, y: blockY, width: blockW - 4, height: LANE_HEIGHT },
        });
      }
    }

    const dDate = parseDateString(day.dateStr);
    const dayFormatted = `${dDate.getDate()} ${ARABIC_MONTHS[dDate.getMonth()]}`;

    daysLayout.push({
      dateStr: day.dateStr,
      dayName: day.dayName,
      dateFormatted: dayFormatted,
      isToday: day.dateStr === data.todayStr,
      bounds: { x: MARGIN_X, y: rowStartY, width: contentWidth, height: rowHeight },
      lanesCount,
      events: eventBlocks,
    });

    currentY += rowHeight;
  }

  const totalGridHeight = currentY - (nextY + gridHeaderHeight);
  gridBounds.height = totalGridHeight + gridHeaderHeight;
  dayColumnBounds.height = totalGridHeight + gridHeaderHeight;

  currentY += 28;

  // Legend
  let legend: { bounds: Rect; items: LegendItemLayout[] } | undefined;
  if (usedCategories.size > 0) {
    const legendH = 56;
    const legendBounds: Rect = { x: MARGIN_X, y: currentY, width: contentWidth, height: legendH };
    const legendItemsList: LegendItemLayout[] = [];

    const categoriesArray = Array.from(usedCategories);
    let itemX = MARGIN_X + contentWidth - 24;

    for (const cat of categoriesArray) {
      const label = CATEGORY_LABELS[cat] || cat;
      const font = '600 20px Tajawal';
      const labelW = measureText(label, font);
      const totalItemW = labelW + 32;

      itemX -= totalItemW;
      legendItemsList.push({
        category: cat,
        label,
        color: CATEGORY_COLORS[cat] || THEME.primary,
        bounds: { x: itemX, y: currentY + 12, width: totalItemW, height: 32 },
      });
      itemX -= 24;
    }

    legend = {
      bounds: legendBounds,
      items: legendItemsList,
    };

    currentY += legendH + 24;
  }

  const { footer, finalHeight } = buildUnifiedFooterLayout({
    width: canvasWidth,
    currentY,
  });

  return {
    type: 'timetable',
    width: canvasWidth,
    height: finalHeight,
    header,
    isEmpty,
    emptyMessage: isEmpty ? 'مفيش محاضرات أو مواعيد الأسبوع ده' : undefined,
    gridBounds,
    dayColumnBounds,
    startHour,
    endHour,
    pxPerHour,
    hourMarks,
    days: daysLayout,
    legend,
    footer,
  };
}

// ---------------------------------------------------------------------------
// 4. Story Layout Builder (جدول اليوم - ستوري 1080x1920)
// ---------------------------------------------------------------------------

export function buildStoryLayout(
  data: {
    dateStr: string;
    todayStr: string;
    events: CalendarEvent[];
    tasks: TaskItem[];
  },
  measureText: TextMeasureFn
): StoryScheduleLayout {
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1920;
  const MARGIN_X = 56;
  const CONTENT_WIDTH = CANVAS_WIDTH - 2 * MARGIN_X;

  const d = parseDateString(data.dateStr);
  const dayName = ARABIC_WEEKDAYS[(d.getDay() + 1) % 7];
  const dateFormatted = `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const isToday = data.dateStr === data.todayStr;

  const validEvents = data.events.filter((e) => !(e as any).deleted && e.date === data.dateStr);
  const validTasks = data.tasks.filter((t) => !(t as any).deleted && getTaskDate(t) === data.dateStr);

  const statsText = `${validEvents.length} مواعيد • ${validTasks.length} مهام`;
  const isEmpty = validEvents.length === 0 && validTasks.length === 0;

  const { header, nextY } = buildUnifiedHeaderLayout({
    width: CANVAS_WIDTH,
    title: isToday ? 'جدول النهارده' : `جدول ${dayName}`,
    subtitle: statsText,
    periodText: dateFormatted,
    measureText,
  });

  // Prepare all timeline items
  const allItems: StoryTimelineItem[] = [];

  // Sort events chronologically
  validEvents.sort((a, b) => {
    const aMin = timeStringToMinutes(a.time || a.start_time || '09:00');
    const bMin = timeStringToMinutes(b.time || b.start_time || '09:00');
    return aMin - bMin;
  });

  const cardW = CONTENT_WIDTH - 120; // 120px for time & timeline rail

  for (const evt of validEvents) {
    const sTime = evt.time || evt.start_time || '09:00';
    const eTime = evt.endTime || evt.end_time;
    const timeText = eTime
      ? `${formatTime12h(sTime)} – ${formatTime12h(eTime)}`
      : formatTime12h(sTime);

    const cat = evt.category || 'custom';
    const catLabel = CATEGORY_LABELS[cat] || 'موعد';
    const catColor = CATEGORY_COLORS[cat] || THEME.primary;

    const titleFont = '700 24px Tajawal';
    const titleLines = wrapText(evt.title, titleFont, cardW - 48, measureText, 2);
    const titleHeight = titleLines.length * 32;

    let locationText: string | undefined;
    const parts: string[] = [];
    if (evt.course) parts.push(evt.course);
    if (evt.doctor_or_ta || evt.instructor) parts.push(evt.doctor_or_ta || evt.instructor!);
    if (evt.location) parts.push(evt.location);
    if (parts.length > 0) locationText = parts.join(' • ');

    const cardHeight = Math.max(96, titleHeight + (locationText ? 32 : 0) + 40);

    allItems.push({
      id: evt.id,
      type: 'event',
      titleLines,
      timeText,
      category: cat,
      categoryLabel: catLabel,
      categoryColor: catColor,
      locationText,
      isCompleted: Boolean(evt.completed || evt.status === 'completed'),
      nodeY: 0,
      cardBounds: { x: MARGIN_X, y: 0, width: cardW, height: cardHeight },
    });
  }

  for (const t of validTasks) {
    const titleFont = '600 22px Tajawal';
    const titleLines = wrapText(t.title, titleFont, cardW - 48, measureText, 2);
    const titleHeight = titleLines.length * 28;
    const cardHeight = Math.max(76, titleHeight + 36);

    allItems.push({
      id: t.id,
      type: 'task',
      titleLines,
      timeText: t.due_time ? formatTime12h(t.due_time) : 'مهمة اليوم',
      categoryColor: THEME.accent,
      isCompleted: Boolean(t.completed || t.status === 'completed'),
      nodeY: 0,
      cardBounds: { x: MARGIN_X, y: 0, width: cardW, height: cardHeight },
    });
  }

  // Automatic pagination across pages of fixed 1080x1920
  const availablePageHeight = CANVAS_HEIGHT - nextY - 140; // 140 for footer & margins
  const pages: StoryPageLayout[] = [];

  if (isEmpty || allItems.length === 0) {
    pages.push({
      pageIndex: 0,
      totalPages: 1,
      items: [],
      hasEvents: false,
      hasTasks: false,
    });
  } else {
    let currentPageItems: StoryTimelineItem[] = [];
    let currentOccupiedHeight = 0;

    for (const item of allItems) {
      const itemTotalH = item.cardBounds.height + 16;
      if (currentOccupiedHeight + itemTotalH > availablePageHeight && currentPageItems.length > 0) {
        // finalize page
        pages.push({
          pageIndex: pages.length,
          totalPages: 0, // assigned after
          items: currentPageItems,
          hasEvents: currentPageItems.some((it) => it.type === 'event'),
          hasTasks: currentPageItems.some((it) => it.type === 'task'),
        });
        currentPageItems = [];
        currentOccupiedHeight = 0;
      }

      currentPageItems.push(item);
      currentOccupiedHeight += itemTotalH;
    }

    if (currentPageItems.length > 0) {
      pages.push({
        pageIndex: pages.length,
        totalPages: 0,
        items: currentPageItems,
        hasEvents: currentPageItems.some((it) => it.type === 'event'),
        hasTasks: currentPageItems.some((it) => it.type === 'task'),
      });
    }

    // Set totalPages and calculate exact Y positions for each page
    const totalPages = pages.length;
    for (const page of pages) {
      page.totalPages = totalPages;
      let pageItemY = nextY + 16;
      for (const item of page.items) {
        item.cardBounds.y = pageItemY;
        item.nodeY = pageItemY + item.cardBounds.height / 2;
        pageItemY += item.cardBounds.height + 16;
      }
    }
  }

  const { footer } = buildUnifiedFooterLayout({
    width: CANVAS_WIDTH,
    currentY: CANVAS_HEIGHT - 60,
  });

  return {
    type: 'story',
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    dateStr: data.dateStr,
    dayName,
    dateFormatted,
    statsText,
    header,
    isEmpty,
    emptyMessage: isEmpty ? 'يومك رايق ومفيش مواعيد أو مهام مسجلة' : undefined,
    pages,
    footer,
  };
}

// ---------------------------------------------------------------------------
// 5. Courses Layout Builder (جدول المواد 1080px)
// ---------------------------------------------------------------------------

export function buildCoursesLayout(
  data: {
    startDateStr: string;
    endDateStr: string;
    rangeFormatted: string;
    todayStr: string;
    events: CalendarEvent[];
  },
  measureText: TextMeasureFn
): CoursesScheduleLayout {
  const CANVAS_WIDTH = 1080;
  const MARGIN_X = 48;
  const CONTENT_WIDTH = CANVAS_WIDTH - 2 * MARGIN_X;

  const { header, nextY } = buildUnifiedHeaderLayout({
    width: CANVAS_WIDTH,
    title: 'جدول المواد والمقررات',
    subtitle: 'توزيع مواعيد المحاضرات والسكاشن حسب المادة',
    periodText: data.rangeFormatted || `${data.startDateStr} – ${data.endDateStr}`,
    measureText,
  });

  let currentY = nextY;

  const validEvents = data.events.filter((e) => !(e as any).deleted);
  const coursesWithEvents = validEvents.filter((e) => e.course?.trim());
  const hasNoCourses = coursesWithEvents.length === 0;

  if (hasNoCourses && validEvents.length === 0) {
    const { footer, finalHeight } = buildUnifiedFooterLayout({
      width: CANVAS_WIDTH,
      currentY: currentY + 180,
    });
    return {
      type: 'courses',
      width: CANVAS_WIDTH,
      height: finalHeight,
      header,
      hasNoCourses: true,
      emptyMessage: 'مفيش مواعيد مسجلة للأسبوع ده',
      courses: [],
      footer,
    };
  }

  // Group events by course
  const courseMap = new Map<string, CalendarEvent[]>();
  const unclassifiedEvents: CalendarEvent[] = [];

  for (const evt of validEvents) {
    const cName = evt.course?.trim();
    if (cName) {
      const list = courseMap.get(cName) || [];
      list.push(evt);
      courseMap.set(cName, list);
    } else {
      unclassifiedEvents.push(evt);
    }
  }

  // Sort courses alphabetically
  const sortedCourseNames = Array.from(courseMap.keys()).sort((a, b) =>
    a.localeCompare(b, 'ar')
  );

  const courseCards: CourseCardLayout[] = [];

  const addCourseCard = (cName: string, evts: CalendarEvent[], isUnclassified = false) => {
    // Sort events chronologically (date then time)
    evts.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const aMin = timeStringToMinutes(a.time || a.start_time || '09:00');
      const bMin = timeStringToMinutes(b.time || b.start_time || '09:00');
      return aMin - bMin;
    });

    // Find dominant category & instructor
    const catCounts: Record<string, number> = {};
    let instructor: string | undefined;

    for (const e of evts) {
      const cat = e.category || 'lecture';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
      if (!instructor && (e.doctor_or_ta || e.instructor)) {
        instructor = (e.doctor_or_ta || e.instructor)!.trim();
      }
    }

    let dominantCat: EventCategory = 'lecture';
    let maxCount = 0;
    for (const [cat, count] of Object.entries(catCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantCat = cat as EventCategory;
      }
    }

    const accentColor = isUnclassified
      ? THEME.primary
      : CATEGORY_COLORS[dominantCat] || THEME.primary;

    const cardStartY = currentY;
    let itemY = cardStartY + 84; // Space for course header

    const courseEventItems: CourseEventItem[] = [];

    for (const evt of evts) {
      const d = parseDateString(evt.date);
      const dayName = ARABIC_WEEKDAYS[(d.getDay() + 1) % 7];
      const sTime = evt.time || evt.start_time || '09:00';
      const eTime = evt.endTime || evt.end_time;
      const timeFormatted = eTime
        ? `${formatTime12h(sTime)} – ${formatTime12h(eTime)}`
        : formatTime12h(sTime);

      const cat = evt.category || 'lecture';
      const catLabel = CATEGORY_LABELS[cat] || 'موعد';
      const catColor = CATEGORY_COLORS[cat] || THEME.primary;

      const itemH = 48;
      courseEventItems.push({
        id: evt.id,
        dayName,
        dateStr: evt.date,
        timeFormatted,
        locationText: evt.location?.trim(),
        category: cat,
        categoryLabel: catLabel,
        categoryColor: catColor,
        isCompleted: Boolean(evt.completed || evt.status === 'completed'),
        bounds: { x: MARGIN_X + 24, y: itemY, width: CONTENT_WIDTH - 48, height: itemH },
      });

      itemY += itemH + 10;
    }

    const totalCardHeight = itemY - cardStartY + 12;

    courseCards.push({
      courseName: cName,
      instructor,
      accentColor,
      events: courseEventItems,
      bounds: { x: MARGIN_X, y: cardStartY, width: CONTENT_WIDTH, height: totalCardHeight },
    });

    currentY += totalCardHeight + 20;
  };

  for (const cName of sortedCourseNames) {
    addCourseCard(cName, courseMap.get(cName)!);
  }

  if (unclassifiedEvents.length > 0) {
    addCourseCard('مواعيد تانية', unclassifiedEvents, true);
  }

  currentY += 12;

  const { footer, finalHeight } = buildUnifiedFooterLayout({
    width: CANVAS_WIDTH,
    currentY,
  });

  return {
    type: 'courses',
    width: CANVAS_WIDTH,
    height: finalHeight,
    header,
    hasNoCourses,
    emptyMessage: hasNoCourses
      ? 'مفيش مواد محددة في مواعيد الأسبوع ده. ضيف اسم "المادة" من تفاصيل الموعد.'
      : undefined,
    courses: courseCards,
    footer,
  };
}

// ---------------------------------------------------------------------------
// 6. Upcoming Layout Builder (اللي قدامك 14 يوم 1080px)
// ---------------------------------------------------------------------------

export function buildUpcomingLayout(
  data: {
    todayStr: string;
    events: CalendarEvent[];
    tasks: TaskItem[];
  },
  measureText: TextMeasureFn
): UpcomingScheduleLayout {
  const CANVAS_WIDTH = 1080;
  const MARGIN_X = 48;
  const CONTENT_WIDTH = CANVAS_WIDTH - 2 * MARGIN_X;

  const todayD = parseDateString(data.todayStr);
  const endD = new Date(todayD);
  endD.setDate(todayD.getDate() + 13);
  const endDateStr = formatDateToISO(endD);

  const { header, nextY } = buildUnifiedHeaderLayout({
    width: CANVAS_WIDTH,
    title: 'اللي قدامك (الـ 14 يوم الجايين)',
    subtitle: 'كل مواعيدك ومهامك القادمة والمتأخرة',
    periodText: `${data.todayStr} – ${endDateStr}`,
    measureText,
  });

  let currentY = nextY;

  // 1. Overdue Tasks (Due before today and incomplete)
  const overdueTasks = data.tasks.filter((t) => {
    if ((t as any).deleted || t.completed || t.status === 'completed') return false;
    const d = getTaskDate(t);
    return Boolean(d && d < data.todayStr);
  });

  // Sort overdue tasks oldest first
  overdueTasks.sort((a, b) => (getTaskDate(a) || '').localeCompare(getTaskDate(b) || ''));

  const groups: UpcomingDayGroup[] = [];

  if (overdueTasks.length > 0) {
    const groupStartY = currentY;
    let itemY = groupStartY + 56;
    const overdueItems: UpcomingItemRow[] = [];

    for (const t of overdueTasks) {
      const taskD = parseDateString(getTaskDate(t) || data.todayStr);
      const diffMs = todayD.getTime() - taskD.getTime();
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      const overdueBadge = formatArabicOverdueText(diffDays);

      const titleFont = '600 22px Tajawal';
      const titleLines = wrapText(t.title, titleFont, CONTENT_WIDTH - 280, measureText, 2);
      const itemH = Math.max(48, titleLines.length * 28 + 12);

      overdueItems.push({
        id: t.id,
        type: 'task',
        titleLines,
        timeOrDueText: t.due_time ? formatTime12h(t.due_time) : 'مهمة متأخرة',
        categoryColor: THEME.warningText,
        iconType: 'alertTriangle',
        relativeDaysBadge: overdueBadge,
        isOverdue: true,
        isCompleted: false,
        bounds: { x: MARGIN_X + 20, y: itemY, width: CONTENT_WIDTH - 40, height: itemH },
      });

      itemY += itemH + 10;
    }

    const groupHeight = itemY - groupStartY + 12;
    groups.push({
      dateStr: 'overdue',
      title: 'مهام متأخرة ومحتاجة تظبيط ⚠️',
      subtitle: `${overdueTasks.length} مهام`,
      isOverdueGroup: true,
      items: overdueItems,
      bounds: { x: MARGIN_X, y: groupStartY, width: CONTENT_WIDTH, height: groupHeight },
    });

    currentY += groupHeight + 20;
  }

  // 2. Next 14 Days from today
  for (let i = 0; i < 14; i++) {
    const curDate = new Date(todayD);
    curDate.setDate(todayD.getDate() + i);
    const dateStr = formatDateToISO(curDate);

    const dayEvts = data.events.filter((e) => !(e as any).deleted && e.date === dateStr);
    const dayTasks = data.tasks.filter(
      (t) => !(t as any).deleted && !t.completed && getTaskDate(t) === dateStr
    );

    if (dayEvts.length === 0 && dayTasks.length === 0) {
      continue; // Skip empty days in upcoming view to keep it crisp
    }

    const dayName = ARABIC_WEEKDAYS[(curDate.getDay() + 1) % 7];
    const dateFormatted = `${curDate.getDate()} ${ARABIC_MONTHS[curDate.getMonth()]}`;
    const relativeBadge = formatArabicDaysRemaining(i);

    const groupTitle = i === 0 ? 'النهارده' : i === 1 ? 'بكرة' : dayName;
    const groupSubtitle = `${dateFormatted} · ${relativeBadge}`;

    const groupStartY = currentY;
    let itemY = groupStartY + 56;
    const dayItems: UpcomingItemRow[] = [];

    // Sort events
    dayEvts.sort((a, b) => {
      const aMin = timeStringToMinutes(a.time || a.start_time || '09:00');
      const bMin = timeStringToMinutes(b.time || b.start_time || '09:00');
      return aMin - bMin;
    });

    for (const evt of dayEvts) {
      const sTime = evt.time || evt.start_time || '09:00';
      const timeFormatted = evt.endTime || evt.end_time
        ? `${formatTime12h(sTime)} – ${formatTime12h(evt.endTime || evt.end_time!)}`
        : formatTime12h(sTime);

      const cat = evt.category || 'custom';
      const titleFont = '700 22px Tajawal';
      const titleLines = wrapText(evt.title, titleFont, CONTENT_WIDTH - 280, measureText, 2);
      const itemH = Math.max(48, titleLines.length * 28 + 12);

      dayItems.push({
        id: evt.id,
        type: 'event',
        titleLines,
        timeOrDueText: timeFormatted,
        category: cat,
        categoryColor: CATEGORY_COLORS[cat] || THEME.primary,
        iconType: 'calendar',
        relativeDaysBadge: relativeBadge,
        isCompleted: Boolean(evt.completed || evt.status === 'completed'),
        bounds: { x: MARGIN_X + 20, y: itemY, width: CONTENT_WIDTH - 40, height: itemH },
      });

      itemY += itemH + 10;
    }

    for (const t of dayTasks) {
      const titleFont = '600 22px Tajawal';
      const titleLines = wrapText(t.title, titleFont, CONTENT_WIDTH - 280, measureText, 2);
      const itemH = Math.max(44, titleLines.length * 26 + 10);

      dayItems.push({
        id: t.id,
        type: 'task',
        titleLines,
        timeOrDueText: t.due_time ? formatTime12h(t.due_time) : 'مهمة',
        categoryColor: THEME.accent,
        iconType: 'task',
        relativeDaysBadge: relativeBadge,
        isCompleted: Boolean(t.completed || t.status === 'completed'),
        bounds: { x: MARGIN_X + 20, y: itemY, width: CONTENT_WIDTH - 40, height: itemH },
      });

      itemY += itemH + 10;
    }

    const groupHeight = itemY - groupStartY + 12;
    groups.push({
      dateStr,
      title: groupTitle,
      subtitle: groupSubtitle,
      isOverdueGroup: false,
      items: dayItems,
      bounds: { x: MARGIN_X, y: groupStartY, width: CONTENT_WIDTH, height: groupHeight },
    });

    currentY += groupHeight + 16;
  }

  const isEmpty = groups.length === 0;

  currentY += 12;

  const { footer, finalHeight } = buildUnifiedFooterLayout({
    width: CANVAS_WIDTH,
    currentY,
  });

  return {
    type: 'upcoming',
    width: CANVAS_WIDTH,
    height: finalHeight,
    header,
    isEmpty,
    emptyMessage: isEmpty ? 'قدامك أسبوعين رايقين ومفيش أي مواعيد أو مهام' : undefined,
    groups,
    footer,
  };
}

// ---------------------------------------------------------------------------
// 7. Summary Layout Builder (ملخص الإنجاز 1080px)
// ---------------------------------------------------------------------------

export function buildSummaryLayout(
  data: {
    startDateStr: string;
    endDateStr: string;
    rangeFormatted: string;
    todayStr: string;
    metrics: ReportMetrics;
    dailyCounts?: Array<{ dateStr: string; dayName: string; count: number }>;
  },
  measureText: TextMeasureFn
): SummaryScheduleLayout {
  const CANVAS_WIDTH = 1080;
  const MARGIN_X = 48;
  const CONTENT_WIDTH = CANVAS_WIDTH - 2 * MARGIN_X;

  const { header, nextY } = buildUnifiedHeaderLayout({
    width: CANVAS_WIDTH,
    title: 'ملخص الإنجاز والنشاط',
    subtitle: 'تقرير تفصيلي لإنتاجيتك ومواعيدك',
    periodText: data.rangeFormatted || `${data.startDateStr} – ${data.endDateStr}`,
    measureText,
  });

  let currentY = nextY;

  const isEmpty = data.metrics.totalEvents === 0 && data.metrics.totalTasks === 0;

  // 1. Top Progress Ring Card + Summary Cards
  const progressCardW = 340;
  const progressCardH = 200;
  const progressCardBounds: Rect = {
    x: MARGIN_X + CONTENT_WIDTH - progressCardW,
    y: currentY,
    width: progressCardW,
    height: progressCardH,
  };

  const statColsW = CONTENT_WIDTH - progressCardW - 20;
  const statCardW = (statColsW - 16) / 2;
  const statCardH = 92;

  const overdueCount = data.metrics.overdueTasksCount ?? (data.metrics as any).overdueTasks ?? 0;
  const completedCount = data.metrics.completedEvents + data.metrics.completedTasks;
  const totalCount = data.metrics.totalEvents + data.metrics.totalTasks;

  const statCards: SummaryCardLayout[] = [
    {
      bounds: {
        x: MARGIN_X + statCardW + 16,
        y: currentY,
        width: statCardW,
        height: statCardH,
      },
      title: 'إجمالي المواعيد',
      value: `${data.metrics.totalEvents}`,
      subtitle: `${data.metrics.completedEvents} مكتمل`,
      iconType: 'calendar',
      iconColor: THEME.primary,
      valueColor: THEME.primary,
    },
    {
      bounds: {
        x: MARGIN_X,
        y: currentY,
        width: statCardW,
        height: statCardH,
      },
      title: 'إجمالي المهام',
      value: `${data.metrics.totalTasks}`,
      subtitle: `${data.metrics.completedTasks} منجزة`,
      iconType: 'task',
      iconColor: THEME.accent,
      valueColor: THEME.accent,
    },
    {
      bounds: {
        x: MARGIN_X + statCardW + 16,
        y: currentY + statCardH + 16,
        width: statCardW,
        height: statCardH,
      },
      title: 'إجمالي العناصر',
      value: `${totalCount}`,
      subtitle: `${completedCount} تم إنجازهم`,
      iconType: 'checkCircle',
      iconColor: THEME.sage,
      valueColor: THEME.sage,
    },
    {
      bounds: {
        x: MARGIN_X,
        y: currentY + statCardH + 16,
        width: statCardW,
        height: statCardH,
      },
      title: 'المهام المتأخرة',
      value: `${overdueCount}`,
      subtitle: overdueCount === 0 ? 'مفيش تأخير 👍' : 'محتاجة مراجعة',
      iconType: 'alertTriangle',
      iconColor: overdueCount > 0 ? THEME.warningText : THEME.sage,
      valueColor: overdueCount > 0 ? THEME.warningText : THEME.sage,
    },
  ];

  currentY += progressCardH + 24;

  // 2. Category Distribution Horizontal Bars
  const catEntries = Object.entries(data.metrics.categoryDistribution) as [
    EventCategory,
    number
  ][];
  catEntries.sort((a, b) => b[1] - a[1]);

  const maxCatCount = Math.max(1, ...catEntries.map((e) => e[1]));
  const catBars: CategoryBarItem[] = [];
  const barCardStartY = currentY;
  let barItemY = barCardStartY + 64;

  for (const [cat, count] of catEntries) {
    if (count <= 0) continue;
    const label = CATEGORY_LABELS[cat] || cat;
    const percentage = Math.round((count / Math.max(1, data.metrics.totalEvents)) * 100);
    const color = CATEGORY_COLORS[cat] || THEME.primary;

    catBars.push({
      category: cat,
      label,
      count,
      percentage,
      color,
      bounds: {
        x: MARGIN_X + 24,
        y: barItemY,
        width: CONTENT_WIDTH - 48,
        height: 38,
      },
    });

    barItemY += 46;
  }

  const categoryCardHeight = Math.max(100, barItemY - barCardStartY + 12);
  const categoryBarsCard = {
    bounds: {
      x: MARGIN_X,
      y: barCardStartY,
      width: CONTENT_WIDTH,
      height: categoryCardHeight,
    },
    title: 'توزيع المواعيد حسب النوع',
    bars: catBars,
  };

  currentY += categoryCardHeight + 24;

  // 3. Busiest Day Card & Daily Activity Bars
  const busiestCardH = 110;
  const busiestD = data.metrics.busiestDay?.date
    ? parseDateString(data.metrics.busiestDay.date)
    : null;
  const busiestDayName = busiestD
    ? ARABIC_WEEKDAYS[(busiestD.getDay() + 1) % 7]
    : 'لا يوجد';
  const busiestDateFormatted = busiestD
    ? `${busiestD.getDate()} ${ARABIC_MONTHS[busiestD.getMonth()]}`
    : '';

  const busiestCard = {
    bounds: {
      x: MARGIN_X,
      y: currentY,
      width: CONTENT_WIDTH,
      height: busiestCardH,
    },
    title: 'أكتر يوم زحمة',
    dayName: busiestDayName,
    dateFormatted: busiestDateFormatted,
    eventCount: data.metrics.busiestDay?.count || 0,
  };

  currentY += busiestCardH + 24;

  // 4. Activity Chart Card
  const activityChartH = 180;
  const activityBars: DailyActivityBar[] = [];

  if (data.dailyCounts && data.dailyCounts.length > 0) {
    const maxDayCount = Math.max(1, ...data.dailyCounts.map((d) => d.count));
    const numBars = data.dailyCounts.length;
    const barWidth = (CONTENT_WIDTH - 48 - (numBars - 1) * 12) / numBars;

    for (let i = 0; i < numBars; i++) {
      const item = data.dailyCounts[i];
      // RTL: index 0 is on the far right
      const barX = MARGIN_X + CONTENT_WIDTH - 24 - (i + 1) * barWidth - i * 12;
      const barRatio = item.count / maxDayCount;
      const barH = Math.max(12, Math.round(barRatio * 70));

      activityBars.push({
        label: item.dayName,
        sublabel: `${item.count}`,
        count: item.count,
        isBusiest: item.count === maxDayCount && maxDayCount > 0,
        barHeight: barH,
        bounds: {
          x: barX,
          y: currentY + 54,
          width: barWidth,
          height: 100,
        },
      });
    }
  }

  const activityChartCard = {
    bounds: {
      x: MARGIN_X,
      y: currentY,
      width: CONTENT_WIDTH,
      height: activityChartH,
    },
    title: 'مخطط النشاط اليومي',
    bars: activityBars,
  };

  currentY += activityChartH + 20;

  const { footer, finalHeight } = buildUnifiedFooterLayout({
    width: CANVAS_WIDTH,
    currentY,
  });

  return {
    type: 'summary',
    width: CANVAS_WIDTH,
    height: finalHeight,
    header,
    isEmpty,
    emptyMessage: isEmpty ? 'مفيش بيانات كافية لعرض ملخص الإنجاز' : undefined,
    progressCard: {
      bounds: progressCardBounds,
      completionRate: data.metrics.completionRate,
      title: 'نسبة الإنجاز الإجمالية',
      subtitle: `${data.metrics.completedEvents + data.metrics.completedTasks} من ${data.metrics.totalEvents + data.metrics.totalTasks} تم إنجازهم`,
    },
    statCards,
    categoryBarsCard,
    busiestCard,
    activityChartCard,
    footer,
  };
}
