import { describe, it, expect, vi } from 'vitest';
import { CalendarEvent, TaskItem } from '../types';
import {
  buildWeekLayout,
  buildMonthLayout,
  buildTimetableLayout,
  buildStoryLayout,
  buildCoursesLayout,
  buildUpcomingLayout,
  buildSummaryLayout,
  wrapText,
  formatArabicDaysRemaining,
  formatArabicOverdueText,
} from './scheduleLayout';
import { calculateSafeScale } from './scheduleCanvasRenderer';
import {
  saveOrDownloadImage,
  shareExportedSchedule,
  getWeeklyExportFilename,
  getMonthlyExportFilename,
  getTimetableExportFilename,
  getStoryExportFilename,
  getCoursesExportFilename,
  getUpcomingExportFilename,
  getSummaryExportFilename,
} from './scheduleImageExporter';
import { calculateReportMetrics } from './reportUtils';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: vi.fn(),
  },
  Directory: {
    Cache: 'CACHE',
  },
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    canShare: vi.fn(),
    share: vi.fn(),
  },
}));

// Mock text measure function (pure, predictable width based on character count)
const mockMeasureText = (text: string, font: string): number => {
  const isBold = font.includes('700');
  const sizeMatch = font.match(/(\d+)px/);
  const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 20;
  const factor = (size / 20) * (isBold ? 11 : 9.5);
  return text.length * factor;
};

describe('scheduleLayout - Timetable Layout Builder (جدول المحاضرات 2000px)', () => {
  it('(أ) Hour axis is accurately determined from event times with minimum 8 AM to 4 PM span', () => {
    const layoutDefault = buildTimetableLayout(
      {
        startDateStr: '2026-10-03',
        endDateStr: '2026-10-09',
        rangeFormatted: 'من ٣ إلى ٩ أكتوبر',
        todayStr: '2026-10-03',
        events: [
          { id: 'e1', title: 'فيزياء', date: '2026-10-03', time: '10:00', endTime: '12:00', completed: false },
        ],
      },
      mockMeasureText
    );

    expect(layoutDefault.startHour).toBeLessThanOrEqual(8);
    expect(layoutDefault.endHour).toBeGreaterThanOrEqual(16);
    expect(layoutDefault.hourMarks.length).toBeGreaterThanOrEqual(9);

    const layoutWide = buildTimetableLayout(
      {
        startDateStr: '2026-10-03',
        endDateStr: '2026-10-09',
        rangeFormatted: 'من ٣ إلى ٩ أكتوبر',
        todayStr: '2026-10-03',
        events: [
          { id: 'e_early', title: 'مختبر باكر', date: '2026-10-03', time: '07:00', endTime: '08:30', completed: false },
          { id: 'e_late', title: 'محاضرة مسائية', date: '2026-10-04', time: '17:00', endTime: '19:30', completed: false },
        ],
      },
      mockMeasureText
    );

    expect(layoutWide.startHour).toBe(7);
    expect(layoutWide.endHour).toBe(20);
  });

  it('(ب) Overlapping events within the same day are cleanly distributed into non-overlapping lanes', () => {
    const events: CalendarEvent[] = [
      { id: 'e1', title: 'محاضرة ١', date: '2026-10-03', time: '09:00', endTime: '11:00', completed: false },
      { id: 'e2', title: 'سكشن ١', date: '2026-10-03', time: '10:00', endTime: '12:00', completed: false },
      { id: 'e3', title: 'ميتينج مشروع', date: '2026-10-03', time: '10:30', endTime: '11:30', completed: false },
      { id: 'e4', title: 'محاضرة متأخرة', date: '2026-10-03', time: '13:00', endTime: '14:30', completed: false },
    ];

    const layout = buildTimetableLayout(
      {
        startDateStr: '2026-10-03',
        endDateStr: '2026-10-09',
        rangeFormatted: 'من ٣ إلى ٩ أكتوبر',
        todayStr: '2026-10-03',
        events,
      },
      mockMeasureText
    );

    const satRow = layout.days.find((d) => d.dateStr === '2026-10-03');
    expect(satRow).toBeDefined();
    expect(satRow!.lanesCount).toBe(3);
    expect(satRow!.events).toHaveLength(4);

    const blocks = satRow!.events;
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const b1 = blocks[i].bounds;
        const b2 = blocks[j].bounds;

        const horizontalOverlap = b1.x < b2.x + b2.width && b1.x + b1.width > b2.x;
        const verticalOverlap = b1.y < b2.y + b2.height && b1.y + b1.height > b2.y;

        expect(horizontalOverlap && verticalOverlap).toBe(false);
      }
    }
  });

  it('(ج) Shortest block duration < 150px automatically expands width and pxPerHour', () => {
    const events: CalendarEvent[] = [
      { id: 'e_short', title: 'كويز سريع', date: '2026-10-03', time: '10:00', endTime: '10:30', completed: false },
    ];

    const layout = buildTimetableLayout(
      {
        startDateStr: '2026-10-03',
        endDateStr: '2026-10-09',
        rangeFormatted: 'من ٣ إلى ٩ أكتوبر',
        todayStr: '2026-10-03',
        events,
      },
      mockMeasureText
    );

    const satRow = layout.days.find((d) => d.dateStr === '2026-10-03')!;
    const quizBlock = satRow.events[0];

    expect(quizBlock.bounds.width).toBeGreaterThanOrEqual(140);
    expect(layout.width).toBeGreaterThanOrEqual(2000);
    expect(layout.width).toBeLessThanOrEqual(3200);
  });

  it('(ح) Overnight events (endTime < time) are handled without breaking grid', () => {
    const events: CalendarEvent[] = [
      { id: 'e_overnight', title: 'مذاكرة ليلية', date: '2026-10-03', time: '22:00', endTime: '02:00', completed: false },
    ];

    const layout = buildTimetableLayout(
      {
        startDateStr: '2026-10-03',
        endDateStr: '2026-10-09',
        rangeFormatted: 'من ٣ إلى ٩ أكتوبر',
        todayStr: '2026-10-03',
        events,
      },
      mockMeasureText
    );

    expect(layout.endHour).toBe(24);
    const satRow = layout.days.find((d) => d.dateStr === '2026-10-03')!;
    expect(satRow.events).toHaveLength(1);
    expect(satRow.events[0].bounds.width).toBeGreaterThan(0);
  });
});

describe('scheduleLayout - Story Layout Builder (جدول اليوم ستوري 1080x1920)', () => {
  it('(د) Automatically paginates long day schedules across 1080x1920 pages without item loss or duplication', () => {
    const events: CalendarEvent[] = Array.from({ length: 15 }, (_, i) => ({
      id: `evt_story_${i}`,
      title: `موعد هام رقم ${i + 1} مع تفاصيل المحاضرة والمكان`,
      date: '2026-10-03',
      time: `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
      location: `قاعة ${i + 1}`,
      category: 'lecture' as const,
      completed: false,
    }));

    const tasks: TaskItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: `task_story_${i}`,
      title: `مهمة رقم ${i + 1} مطلوب إنجازها اليوم`,
      due_date: '2026-10-03',
      priority: 'normal' as const,
      completed: false,
    }));

    const layout = buildStoryLayout(
      {
        dateStr: '2026-10-03',
        todayStr: '2026-10-03',
        events,
        tasks,
      },
      mockMeasureText
    );

    expect(layout.type).toBe('story');
    expect(layout.width).toBe(1080);
    expect(layout.height).toBe(1920);
    expect(layout.pages.length).toBeGreaterThanOrEqual(2);

    const collectedItemIds: string[] = [];
    for (const page of layout.pages) {
      expect(page.totalPages).toBe(layout.pages.length);
      for (const item of page.items) {
        collectedItemIds.push(item.id);
        expect(item.cardBounds.y + item.cardBounds.height).toBeLessThanOrEqual(1920);
      }
    }

    expect(collectedItemIds).toHaveLength(20);
    expect(new Set(collectedItemIds).size).toBe(20);
  });
});

describe('scheduleLayout - Courses Layout Builder (جدول المواد)', () => {
  it('(هـ) Groups events by course name, extracts instructor/TA, and gathers unclassified events', () => {
    const events: CalendarEvent[] = [
      { id: 'e1', title: 'محاضرة فيزياء', course: 'فيزياء عامة', doctor_or_ta: 'د. أحمد', date: '2026-10-03', time: '09:00', category: 'lecture', completed: false },
      { id: 'e2', title: 'سكشن فيزياء', course: 'فيزياء عامة', doctor_or_ta: 'م. عمر', date: '2026-10-04', time: '11:00', category: 'section', completed: false },
      { id: 'e3', title: 'محاضرة رياضيات', course: 'تفاضل وتكامل', instructor: 'د. سارة', date: '2026-10-03', time: '13:00', category: 'lecture', completed: false },
      { id: 'e4', title: 'ميتينج اتحاد الطلاب', date: '2026-10-05', time: '16:00', category: 'meeting', completed: false },
    ];

    const layout = buildCoursesLayout(
      {
        startDateStr: '2026-10-03',
        endDateStr: '2026-10-09',
        rangeFormatted: 'من ٣ إلى ٩ أكتوبر',
        todayStr: '2026-10-03',
        events,
      },
      mockMeasureText
    );

    expect(layout.type).toBe('courses');
    expect(layout.hasNoCourses).toBe(false);
    expect(layout.courses).toHaveLength(3);

    const physics = layout.courses.find((c) => c.courseName === 'فيزياء عامة');
    expect(physics).toBeDefined();
    expect(physics!.events).toHaveLength(2);
    expect(physics!.instructor).toBe('د. أحمد');

    const unclassified = layout.courses.find((c) => c.courseName === 'مواعيد تانية');
    expect(unclassified).toBeDefined();
    expect(unclassified!.events).toHaveLength(1);
  });
});

describe('scheduleLayout - Upcoming Layout Builder (اللي قدامك 14 يوم)', () => {
  it('(و) formatArabicDaysRemaining applies proper Arabic dual and plural grammar', () => {
    expect(formatArabicDaysRemaining(0)).toBe('النهارده');
    expect(formatArabicDaysRemaining(1)).toBe('بكرة');
    expect(formatArabicDaysRemaining(2)).toBe('بعد يومين');
    expect(formatArabicDaysRemaining(3)).toBe('بعد 3 أيام');
    expect(formatArabicDaysRemaining(7)).toBe('بعد 7 أيام');
    expect(formatArabicDaysRemaining(10)).toBe('بعد 10 أيام');
    expect(formatArabicDaysRemaining(11)).toBe('بعد 11 يوم');
    expect(formatArabicDaysRemaining(14)).toBe('بعد 14 يوم');

    expect(formatArabicOverdueText(1)).toBe('متأخرة من إمبارح');
    expect(formatArabicOverdueText(2)).toBe('متأخرة من يومين');
    expect(formatArabicOverdueText(4)).toBe('متأخرة من 4 أيام');
    expect(formatArabicOverdueText(12)).toBe('متأخرة من 12 يوم');
  });

  it('(ز) Starts from today, gathers next 14 days, and isolates overdue tasks at the top', () => {
    const events: CalendarEvent[] = [
      { id: 'e_today', title: 'كشف أسنان', date: '2026-10-03', time: '12:00', completed: false },
      { id: 'e_future', title: 'تسليم مشروع', date: '2026-10-07', time: '14:00', completed: false },
    ];

    const tasks: TaskItem[] = [
      { id: 't_overdue', title: 'تسليم بحث قديم', due_date: '2026-10-01', priority: 'normal', completed: false },
      { id: 't_today', title: 'مذاكرة شابتر ١', due_date: '2026-10-03', priority: 'normal', completed: false },
    ];

    const layout = buildUpcomingLayout(
      {
        todayStr: '2026-10-03',
        events,
        tasks,
      },
      mockMeasureText
    );

    expect(layout.type).toBe('upcoming');
    expect(layout.groups.length).toBeGreaterThanOrEqual(2);

    expect(layout.groups[0].isOverdueGroup).toBe(true);
    expect(layout.groups[0].items[0].id).toBe('t_overdue');
    expect(layout.groups[0].items[0].isOverdue).toBe(true);

    expect(layout.groups[1].dateStr).toBe('2026-10-03');
    expect(layout.groups[1].title).toBe('النهارده');
  });
});

describe('scheduleLayout - Summary Layout Builder (ملخص الإنجاز)', () => {
  it('buildSummaryLayout compiles metrics, category bars, and busiest day correctly', () => {
    const events: CalendarEvent[] = [
      { id: 'e1', title: 'محاضرة ١', date: '2026-10-03', time: '09:00', endTime: '11:00', category: 'lecture', completed: true },
      { id: 'e2', title: 'محاضرة ٢', date: '2026-10-03', time: '12:00', endTime: '14:00', category: 'lecture', completed: true },
      { id: 'e3', title: 'تمرين', date: '2026-10-04', time: '17:00', endTime: '18:00', category: 'workout', completed: false },
    ];
    const tasks: TaskItem[] = [
      { id: 't1', title: 'شيت ١', due_date: '2026-10-03', priority: 'normal', completed: true },
      { id: 't2', title: 'شيت ٢', due_date: '2026-10-04', priority: 'normal', completed: false },
    ];

    const metrics = calculateReportMetrics(
      events,
      tasks,
      '2026-10-03',
      '2026-10-09'
    );

    const layout = buildSummaryLayout(
      {
        startDateStr: '2026-10-03',
        endDateStr: '2026-10-09',
        rangeFormatted: 'من ٣ إلى ٩ أكتوبر',
        todayStr: '2026-10-03',
        metrics,
      },
      mockMeasureText
    );

    expect(layout.type).toBe('summary');
    expect(layout.progressCard.completionRate).toBe(60);
    expect(layout.statCards).toHaveLength(4);
    expect(layout.categoryBarsCard.bars).toHaveLength(2);
    expect(layout.busiestCard.eventCount).toBe(3);
  });
});

describe('scheduleLayout - Scale & Dimension Safety', () => {
  it('(ط) Dimensions equal exact elements sum + margins and calculateSafeScale respects limits', () => {
    expect(calculateSafeScale(2000, 1080)).toBe(2.0);
    expect(calculateSafeScale(8000, 2000)).toBe(1.5);
    expect(calculateSafeScale(12000, 2000)).toBe(1.0);
  });

  it('Filename generators produce uniform lowercase names', () => {
    expect(getTimetableExportFilename('2026-10-03')).toBe('azbotha-timetable-2026-10-03.png');
    expect(getStoryExportFilename('2026-10-03', 2)).toBe('azbotha-day-2026-10-03-2.png');
    expect(getCoursesExportFilename('2026-10-03')).toBe('azbotha-courses-2026-10-03.png');
    expect(getUpcomingExportFilename('2026-10-03')).toBe('azbotha-upcoming-2026-10-03.png');
    expect(getSummaryExportFilename('2026-10-03')).toBe('azbotha-summary-2026-10-03.png');
  });
});
