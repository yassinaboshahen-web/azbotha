import { CalendarEvent, TaskItem, EventCategory } from '../types';
import { getTodayDateString, parseDateString } from './dateUtils';

export interface ReportMetrics {
  totalEvents: number;
  completedEvents: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  busiestDay: { name: string; count: number; date: string } | null;
  dailyDistribution: Record<string, { events: number; tasks: number }>;
  categoryDistribution: Record<EventCategory | 'custom', number>;
  overdueTasksCount: number;
}

export const CATEGORY_LABELS: Record<string, string> = {
  lecture: 'محاضرة',
  section: 'سكشن',
  meeting: 'ميتينج',
  workout: 'تمرين',
  personal: 'شخصي',
  study: 'مذاكرة',
  custom: 'عام',
};

/**
 * Calculates report metrics for a given date range.
 */
export function calculateReportMetrics(
  events: CalendarEvent[],
  tasks: TaskItem[],
  startDateStr: string,
  endDateStr: string,
  todayStr: string = getTodayDateString()
): ReportMetrics {
  const filteredEvents = events.filter(e => e.date >= startDateStr && e.date <= endDateStr);
  const filteredTasks = tasks.filter(t => {
    const d = t.due_date || t.date;
    return d && d >= startDateStr && d <= endDateStr;
  });

  const completedEvents = filteredEvents.filter(e => e.completed || e.status === 'completed').length;
  const completedTasks = filteredTasks.filter(t => t.completed || t.status === 'completed').length;

  const totalEvents = filteredEvents.length;
  const totalTasks = filteredTasks.length;
  const totalItems = totalEvents + totalTasks;
  const totalCompleted = completedEvents + completedTasks;

  const completionRate = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;

  // Overdue calculation (global check, or range check? User said "due_date before today and not finished")
  const overdueTasksCount = tasks.filter(t => {
    const d = t.due_date || t.date;
    return d && d < todayStr && !t.completed && t.status !== 'completed';
  }).length;

  // Daily distribution & Busiest day
  const dailyDistribution: Record<string, { events: number; tasks: number }> = {};
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  filteredEvents.forEach(e => {
    if (!dailyDistribution[e.date]) dailyDistribution[e.date] = { events: 0, tasks: 0 };
    dailyDistribution[e.date].events++;
  });

  filteredTasks.forEach(t => {
    const d = t.due_date || t.date;
    if (d) {
      if (!dailyDistribution[d]) dailyDistribution[d] = { events: 0, tasks: 0 };
      dailyDistribution[d].tasks++;
    }
  });

  let busiestDay: ReportMetrics['busiestDay'] = null;
  Object.entries(dailyDistribution).forEach(([date, counts]) => {
    const total = counts.events + counts.tasks;
    if (!busiestDay || total > busiestDay.count) {
      const d = parseDateString(date);
      busiestDay = {
        date,
        count: total,
        name: dayNames[d.getDay()],
      };
    }
  });

  // Category distribution
  const categoryDistribution: Record<string, number> = {
    lecture: 0,
    section: 0,
    meeting: 0,
    workout: 0,
    personal: 0,
    study: 0,
    custom: 0,
  };

  filteredEvents.forEach(e => {
    const cat = e.category || 'custom';
    categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
  });

  return {
    totalEvents,
    completedEvents,
    totalTasks,
    completedTasks,
    completionRate,
    busiestDay,
    dailyDistribution,
    categoryDistribution: categoryDistribution as ReportMetrics['categoryDistribution'],
    overdueTasksCount,
  };
}

/**
 * Formats a summary text for sharing.
 */
export function formatReportSummaryText(metrics: ReportMetrics, periodName: string): string {
  const { completionRate, totalEvents, totalTasks, busiestDay, overdueTasksCount } = metrics;
  
  let text = `📊 ملخص ${periodName} لـ "صاحب يومك":\n\n`;
  
  if (totalEvents + totalTasks === 0) {
    return `${text}الفترة دي كانت هادية جداً، مفيش مواعيد أو مهام مسجلة. ريح دماغك! 😌`;
  }

  text += `✅ نسبة الإنجاز: ${completionRate}%\n`;
  if (totalEvents > 0) text += `📅 المواعيد: ${totalEvents}\n`;
  if (totalTasks > 0) text += `📝 المهام: ${totalTasks}\n`;
  
  if (busiestDay) {
    text += `🔥 أكتر يوم كان زحمة: ${busiestDay.name} (${busiestDay.count} حاجات)\n`;
  }
  
  if (overdueTasksCount > 0) {
    text += `⚠️ مهام متأخرة محتاجة تركيز: ${overdueTasksCount}\n`;
  }

  text += `\nعاش يا بطل، يومك موفق! 🚀`;
  
  return text;
}
