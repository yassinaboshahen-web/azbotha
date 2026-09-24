import { describe, it, expect } from 'vitest';
import { calculateReportMetrics } from './reportUtils';
import { CalendarEvent, TaskItem } from '../types';

describe('reportUtils - calculateReportMetrics', () => {
  it('should handle empty periods correctly', () => {
    const metrics = calculateReportMetrics([], [], '2026-09-01', '2026-09-30', '2026-09-24');
    expect(metrics.totalEvents).toBe(0);
    expect(metrics.totalTasks).toBe(0);
    expect(metrics.completionRate).toBe(0);
    expect(metrics.busiestDay).toBeNull();
  });

  it('should calculate completion rate and overdue tasks correctly', () => {
    const events: CalendarEvent[] = [
      { id: 'e1', title: 'E1', date: '2026-09-20', time: '10:00', completed: true, status: 'completed' },
      { id: 'e2', title: 'E2', date: '2026-09-21', time: '11:00', completed: false, status: 'upcoming' },
    ];
    const tasks: TaskItem[] = [
      { id: 't1', title: 'T1', date: '2026-09-20', completed: true, status: 'completed', priority: 'normal' },
      { id: 't2', title: 'T2', date: '2026-09-19', completed: false, status: 'pending', priority: 'high' }, // Overdue (before range but overdue is global)
      { id: 't3', title: 'T3', date: '2026-09-21', completed: false, status: 'pending', priority: 'normal' },
    ];

    // Range: Sep 20 to Sep 21
    const metrics = calculateReportMetrics(events, tasks, '2026-09-20', '2026-09-21', '2026-09-24');

    expect(metrics.totalEvents).toBe(2);
    expect(metrics.totalTasks).toBe(2); // t1, t3 are in range. t2 is outside range but contributes to overdue.
    
    // Items in range: e1(comp), e2(uncomp), t1(comp), t3(uncomp) -> 2/4 = 50%
    expect(metrics.completionRate).toBe(50);
    expect(metrics.overdueTasksCount).toBe(2); // t2 and t3 are overdue
  });

  it('should identify busiest day correctly', () => {
    const events: CalendarEvent[] = [
      { id: 'e1', title: 'E1', date: '2026-09-20', time: '10:00', completed: false },
      { id: 'e2', title: 'E2', date: '2026-09-20', time: '12:00', completed: false },
    ];
    const tasks: TaskItem[] = [
      { id: 't1', title: 'T1', date: '2026-09-21', completed: false, priority: 'normal' },
    ];

    const metrics = calculateReportMetrics(events, tasks, '2026-09-20', '2026-09-21', '2026-09-24');
    expect(metrics.busiestDay?.date).toBe('2026-09-20');
    expect(metrics.busiestDay?.count).toBe(2);
  });

  it('should handle month boundaries correctly', () => {
    const events: CalendarEvent[] = [
      { id: 'e1', title: 'E1', date: '2026-08-31', time: '10:00', completed: false },
      { id: 'e2', title: 'E2', date: '2026-09-01', time: '10:00', completed: false },
    ];
    const metrics = calculateReportMetrics(events, [], '2026-09-01', '2026-09-30', '2026-09-24');
    expect(metrics.totalEvents).toBe(1);
    expect(metrics.totalEvents).toBe(1);
    expect(metrics.dailyDistribution['2026-09-01']).toBeDefined();
    expect(metrics.dailyDistribution['2026-08-31']).toBeUndefined();
  });
});
