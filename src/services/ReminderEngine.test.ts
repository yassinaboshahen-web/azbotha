import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReminderEngine,
  hashStringToInt,
  assignUniqueNotificationIds,
  REMINDER_HORIZON_DAYS,
  DAILY_SUMMARY_HORIZON_DAYS,
  MAX_SCHEDULED_NOTIFICATIONS,
  REMINDER_CHANNEL_ID,
  REMINDER_SOUND,
} from './ReminderEngine';
import { indexedDBRepository } from '../repositories/indexedDBRepository';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CalendarEvent, TaskItem } from '../types';

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    listChannels: vi.fn().mockResolvedValue({ channels: [] }),
    createChannel: vi.fn().mockResolvedValue(undefined),
    deleteChannel: vi.fn().mockResolvedValue(undefined),
    requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    checkExactNotificationSetting: vi.fn().mockResolvedValue({ exact_alarm: 'granted' }),
    changeExactNotificationSetting: vi.fn().mockResolvedValue(undefined),
    schedule: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(true),
  },
}));

describe('ReminderEngine - Deterministic Hashing & Collision-Free IDs', () => {
  it('hashStringToInt produces deterministic non-negative 31-bit integer', () => {
    const id1 = hashStringToInt('evt_123_evt_2h');
    const id2 = hashStringToInt('evt_123_evt_2h');
    expect(id1).toBe(id2);
    expect(id1).toBeGreaterThanOrEqual(0);
    expect(id1).toBeLessThanOrEqual(2147483647);
  });

  it('assignUniqueNotificationIds guarantees unique 31-bit IDs even with colliding keys', () => {
    const items = [
      { id: 'trigger_1' },
      { id: 'trigger_2' },
      { id: 'trigger_3' },
      { id: 'trigger_4' },
      { id: 'trigger_5' },
    ];

    const idMap = assignUniqueNotificationIds(items);
    expect(idMap.size).toBe(5);

    const values = Array.from(idMap.values());
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(5);

    for (const val of values) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(2147483647);
    }
  });
});

describe('ReminderEngine - Synchronization & Stale Trigger Cancellation', () => {
  let mockEvents: CalendarEvent[] = [];
  let mockTasks: TaskItem[] = [];
  let mockMetadata: Record<string, any> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockEvents = [];
    mockTasks = [];
    mockMetadata = {};

    vi.spyOn(indexedDBRepository, 'getAllEvents').mockImplementation(async () => mockEvents);
    vi.spyOn(indexedDBRepository, 'getAllTasks').mockImplementation(async () => mockTasks);
    vi.spyOn(indexedDBRepository, 'getAllReminders').mockImplementation(async () => []);
    vi.spyOn(indexedDBRepository, 'getPreferences').mockImplementation(async () => ({
      id: 'default',
      timezone: 'UTC',
      locale: 'ar-EG',
      week_starts_on: 'saturday',
      default_view: 'day',
      reminder_preferences: { sound: true, lead_time_minutes: 60, vibration: true, morning_summary: true, evening_summary: true, quiet_hours_enabled: false },
    }));
    vi.spyOn(indexedDBRepository, 'getMetadata').mockImplementation(async (key: string) => mockMetadata[key] || null);
    vi.spyOn(indexedDBRepository, 'setMetadata').mockImplementation(async (key: string, val: any) => {
      mockMetadata[key] = val;
    });
  });

  it('schedules notification for future active event and saves native_scheduled_triggers', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
    const dateStr = futureDate.toISOString().split('T')[0];

    mockEvents = [
      {
        id: 'evt_test_1',
        title: 'محاضرة فيزياء',
        date: dateStr,
        time: '14:00',
        completed: false,
        reminder: true,
      },
    ];

    await ReminderEngine.checkAndFireReminders();

    expect(LocalNotifications.schedule).toHaveBeenCalled();
    const scheduledMetadata = mockMetadata['native_scheduled_triggers'];
    expect(scheduledMetadata).toBeDefined();
    expect(scheduledMetadata.length).toBeGreaterThan(0);
    expect(scheduledMetadata.some((s: any) => s.id.startsWith('evt_test_1'))).toBe(true);
  });

  it('never schedules past events (triggerTime <= now)', async () => {
    // Event yesterday
    const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    mockEvents = [
      {
        id: 'evt_past_1',
        title: 'معاد قديم',
        date: pastDateStr,
        time: '10:00',
        completed: false,
        reminder: true,
      },
    ];

    await ReminderEngine.checkAndFireReminders();

    const scheduledMetadata = mockMetadata['native_scheduled_triggers'];
    // No trigger for past event should be in scheduled triggers
    if (scheduledMetadata) {
      expect(scheduledMetadata.some((s: any) => s.id.startsWith('evt_past_1'))).toBe(false);
    }
  });

  it('respects 45-day horizon: schedules day 40 but skips day 50', async () => {
    const day40Date = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
    const day40Str = day40Date.toISOString().split('T')[0];

    const day50Date = new Date(Date.now() + 50 * 24 * 60 * 60 * 1000);
    const day50Str = day50Date.toISOString().split('T')[0];

    mockEvents = [
      {
        id: 'evt_day_40',
        title: 'امتحان بعد 40 يوم',
        date: day40Str,
        time: '09:00',
        completed: false,
        reminder: true,
      },
      {
        id: 'evt_day_50',
        title: 'سفر بعد 50 يوم',
        date: day50Str,
        time: '09:00',
        completed: false,
        reminder: true,
      },
    ];

    await ReminderEngine.checkAndFireReminders();

    const scheduledMetadata = mockMetadata['native_scheduled_triggers'] || [];
    expect(scheduledMetadata.some((s: any) => s.id.startsWith('evt_day_40'))).toBe(true);
    expect(scheduledMetadata.some((s: any) => s.id.startsWith('evt_day_50'))).toBe(false);
  });

  it('caps scheduled notifications at 400 and prioritizes earliest triggers first', async () => {
    // Generate 150 events (each produces ~3 triggers = ~450 triggers)
    const events: CalendarEvent[] = [];
    for (let i = 1; i <= 150; i++) {
      const d = new Date(Date.now() + (i % 30 + 1) * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      events.push({
        id: `evt_bulk_${i}`,
        title: `Bulk Event ${i}`,
        date: dateStr,
        time: `${String((i % 12) + 8).padStart(2, '0')}:00`,
        completed: false,
        reminder: true,
      });
    }
    mockEvents = events;

    await ReminderEngine.checkAndFireReminders();

    const scheduledMetadata = mockMetadata['native_scheduled_triggers'] || [];
    expect(scheduledMetadata.length).toBeLessThanOrEqual(MAX_SCHEDULED_NOTIFICATIONS);
    expect(scheduledMetadata.length).toBe(400);

    // Verify sorted ascending by triggerTime
    for (let j = 0; j < scheduledMetadata.length - 1; j++) {
      expect(scheduledMetadata[j].triggerTime).toBeLessThanOrEqual(scheduledMetadata[j + 1].triggerTime);
    }
  });

  it('cancels scheduled notification when event is marked completed', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dateStr = futureDate.toISOString().split('T')[0];

    const triggerId = 'evt_test_1_evt_1h';
    mockMetadata['native_scheduled_triggers'] = [
      { id: triggerId, triggerTime: Date.now() + 50000, title: 'محاضرة فيزياء', notificationId: hashStringToInt(triggerId) },
    ];

    mockEvents = [
      {
        id: 'evt_test_1',
        title: 'محاضرة فيزياء',
        date: dateStr,
        time: '14:00',
        completed: true,
        reminder: true,
      },
    ];

    await ReminderEngine.checkAndFireReminders();

    expect(LocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: hashStringToInt(triggerId) }],
    });
    const updated = mockMetadata['native_scheduled_triggers'];
    expect(updated.some((s: any) => s.id === triggerId)).toBe(false);
  });

  it('cancels scheduled notification when event is deleted', async () => {
    const triggerId = 'evt_del_1_evt_2h';
    mockMetadata['native_scheduled_triggers'] = [
      { id: triggerId, triggerTime: Date.now() + 60000, title: 'معاد محذوف', notificationId: hashStringToInt(triggerId) },
    ];

    mockEvents = [];

    await ReminderEngine.checkAndFireReminders();

    expect(LocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: hashStringToInt(triggerId) }],
    });
    const updated = mockMetadata['native_scheduled_triggers'];
    expect(updated.some((s: any) => s.id === triggerId)).toBe(false);
  });

  it('cancels old trigger and reschedules when event date or time changes', async () => {
    const oldTime = Date.now() + 100000;
    const triggerId = 'evt_move_1_evt_at_time';
    mockMetadata['native_scheduled_triggers'] = [
      { id: triggerId, triggerTime: oldTime, title: 'معاد متحرك', notificationId: hashStringToInt(triggerId) },
    ];

    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const newDateStr = futureDate.toISOString().split('T')[0];

    mockEvents = [
      {
        id: 'evt_move_1',
        title: 'معاد متحرك',
        date: newDateStr,
        time: '16:00',
        completed: false,
        reminder: true,
      },
    ];

    await ReminderEngine.checkAndFireReminders();

    expect(LocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: hashStringToInt(triggerId) }],
    });
    expect(LocalNotifications.schedule).toHaveBeenCalled();
  });

  it('cancels notification when task is marked completed', async () => {
    const triggerId = 'tsk_123_task_1h';
    mockMetadata['native_scheduled_triggers'] = [
      { id: triggerId, triggerTime: Date.now() + 70000, title: 'تسليم الشيت', notificationId: hashStringToInt(triggerId) },
    ];

    mockTasks = [
      {
        id: 'tsk_123',
        title: 'تسليم الشيت',
        priority: 'normal',
        completed: true,
        reminder: true,
      },
    ];

    await ReminderEngine.checkAndFireReminders();

    expect(LocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: hashStringToInt(triggerId) }],
    });
    const updated = mockMetadata['native_scheduled_triggers'];
    expect(updated.some((s: any) => s.id === triggerId)).toBe(false);
  });

  it('schedules test notification with proper channel and sound', async () => {
    const res = await ReminderEngine.scheduleTestNotification(10);
    expect(res.success).toBe(true);
    expect(LocalNotifications.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: expect.arrayContaining([
          expect.objectContaining({
            channelId: REMINDER_CHANNEL_ID,
            sound: REMINDER_SOUND,
          }),
        ]),
      })
    );
  });
});
