import { queryOne, queryMany } from '../db/client';

export interface DayCount {
  date: string;
  dayName: string;
  count: number;
}

export interface WeeklyFactualInsights {
  weekStart: string;
  weekEnd: string;
  isEmpty: boolean;
  totalEvents: number;
  totalTasks: number;
  completedTasks: number;
  unfinishedTasks: number;
  busiestDay: {
    date: string;
    dayName: string;
    totalItems: number;
    eventsCount: number;
    tasksCount: number;
  } | null;
  eventCountByDay: DayCount[];
  taskCountByDay: DayCount[];
  summaryNote: string;
}

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const insightService = {
  async getWeeklySummary(userId: string, targetDateStr?: string): Promise<WeeklyFactualInsights> {
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    
    // Egyptian / Arab workweek starts Saturday
    const day = targetDate.getDay();
    const diffToSaturday = (day + 1) % 7;
    
    const weekStartDate = new Date(targetDate);
    weekStartDate.setDate(targetDate.getDate() - diffToSaturday);
    weekStartDate.setHours(0, 0, 0, 0);

    const startIso = weekStartDate.toISOString().split('T')[0];

    // Build the 7 dates of the week
    const weekDays: Array<{ date: string; dayName: string }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartDate);
      d.setDate(weekStartDate.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayName = ARABIC_DAYS[d.getDay()];
      weekDays.push({ date: iso, dayName });
    }
    const endIso = weekDays[6].date;

    // 1. Query overall tasks in range
    let totalTasks = 0;
    let completedTasks = 0;
    const taskCountMap = new Map<string, number>();
    try {
      const taskStats = await queryOne<{ total: number; completed: number }>({
        sql: `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
              FROM tasks
              WHERE (anonymous_user_id = ? OR user_id = ?)
                AND (due_date BETWEEN ? AND ?)`,
        args: [userId, userId, startIso, endIso],
      });
      totalTasks = Number(taskStats?.total || 0);
      completedTasks = Number(taskStats?.completed || 0);

      const dayTasks = await queryMany<{ due_date: string; count: number }>({
        sql: `SELECT due_date, COUNT(*) as count 
              FROM tasks 
              WHERE (anonymous_user_id = ? OR user_id = ?) 
                AND (due_date BETWEEN ? AND ?) 
              GROUP BY due_date`,
        args: [userId, userId, startIso, endIso],
      });
      for (const row of dayTasks) {
        if (row.due_date) {
          taskCountMap.set(row.due_date, Number(row.count));
        }
      }
    } catch {
      // ignore
    }

    const unfinishedTasks = Math.max(0, totalTasks - completedTasks);

    // 2. Query overall events in range
    let totalEvents = 0;
    const eventCountMap = new Map<string, number>();
    try {
      const eventStats = await queryOne<{ total: number }>({
        sql: `SELECT COUNT(*) as total
              FROM events
              WHERE (anonymous_user_id = ? OR user_id = ?)
                AND (date BETWEEN ? AND ?)`,
        args: [userId, userId, startIso, endIso],
      });
      totalEvents = Number(eventStats?.total || 0);

      const dayEvents = await queryMany<{ date: string; count: number }>({
        sql: `SELECT date, COUNT(*) as count 
              FROM events 
              WHERE (anonymous_user_id = ? OR user_id = ?) 
                AND (date BETWEEN ? AND ?) 
              GROUP BY date`,
        args: [userId, userId, startIso, endIso],
      });
      for (const row of dayEvents) {
        if (row.date) {
          eventCountMap.set(row.date, Number(row.count));
        }
      }
    } catch {
      // ignore
    }

    if (totalEvents === 0 && totalTasks === 0) {
      return {
        weekStart: startIso,
        weekEnd: endIso,
        isEmpty: true,
        totalEvents: 0,
        totalTasks: 0,
        completedTasks: 0,
        unfinishedTasks: 0,
        busiestDay: null,
        eventCountByDay: weekDays.map((d) => ({ date: d.date, dayName: d.dayName, count: 0 })),
        taskCountByDay: weekDays.map((d) => ({ date: d.date, dayName: d.dayName, count: 0 })),
        summaryNote: 'مفيش بيانات مسجلة في الأسبوع ده حتى الآن.',
      };
    }

    // Determine busiest day
    let maxItems = 0;
    let busiest: {
      date: string;
      dayName: string;
      totalItems: number;
      eventsCount: number;
      tasksCount: number;
    } | null = null;

    for (const d of weekDays) {
      const eCount = eventCountMap.get(d.date) || 0;
      const tCount = taskCountMap.get(d.date) || 0;
      const tot = eCount + tCount;
      if (tot > maxItems) {
        maxItems = tot;
        busiest = {
          date: d.date,
          dayName: d.dayName,
          totalItems: tot,
          eventsCount: eCount,
          tasksCount: tCount,
        };
      }
    }

    const summaryNote = `إجمالي ${totalEvents} مواعيد و${totalTasks} مهام (${completedTasks} منجزة${unfinishedTasks > 0 ? `، و${unfinishedTasks} باقية` : ''}).`;

    return {
      weekStart: startIso,
      weekEnd: endIso,
      isEmpty: false,
      totalEvents,
      totalTasks,
      completedTasks,
      unfinishedTasks,
      busiestDay: busiest,
      eventCountByDay: weekDays.map((d) => ({ date: d.date, dayName: d.dayName, count: eventCountMap.get(d.date) || 0 })),
      taskCountByDay: weekDays.map((d) => ({ date: d.date, dayName: d.dayName, count: taskCountMap.get(d.date) || 0 })),
      summaryNote,
    };
  },
};
