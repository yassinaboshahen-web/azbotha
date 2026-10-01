import { CalendarEvent, TaskItem, QuickThought, NotificationItem } from '../types';
import { indexedDBRepository } from '../repositories/indexedDBRepository';
import { sound } from '../utils/audio';
import { combineDateAndTime, parseCalendarDate, formatCalendarDate } from '../utils/dateUtils';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export interface ReminderTrigger {
  id: string; // Unique trigger ID: `${entityId}_${triggerKey}`
  entityId: string;
  entityType: 'event' | 'task' | 'thought';
  triggerTime: number; // UTC timestamp in milliseconds
  title: string;
  body: string;
  notificationType: 'upcoming' | 'task' | 'tomorrow' | 'reminder' | 'morning' | 'evening' | 'general';
}

export interface ScheduledTriggerRecord {
  id: string;
  triggerTime: number;
  title?: string;
  body?: string;
  notificationId?: number;
}

export const REMINDER_CHANNEL_ID = 'azbatha_reminders_audible_v2';
export const REMINDER_SOUND = 'azbotha_notification.ogg';

// 45 days forward horizon for events/tasks, 14 days for daily summary
export const REMINDER_HORIZON_DAYS = 45;
export const DAILY_SUMMARY_HORIZON_DAYS = 14;
export const MAX_SCHEDULED_NOTIFICATIONS = 400; // Safe threshold well under Android's ~500 limit

const FIRED_REMINDERS_KEY = 'fired_reminders_set';

/**
 * Deterministic 31-bit FNV-1a based integer hash ensuring a safe non-negative integer (0 to 2147483647).
 * Avoids Java/Kotlin Integer overflow edge cases on Android AlarmManager / NotificationManager.
 */
export function hashStringToInt(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash & 0x7fffffff);
}

/**
 * Assigns collision-free, deterministic 31-bit integer notification IDs to an array of triggers.
 * If two distinct triggers produce the same base hash, increments deterministically until unique.
 */
export function assignUniqueNotificationIds<T extends { id: string }>(items: T[]): Map<string, number> {
  const assigned = new Map<string, number>();
  const usedIntIds = new Set<number>();

  for (const item of items) {
    let intId = hashStringToInt(item.id);
    // If collision occurs within this batch, resolve by linear probing within 31-bit integer range
    while (usedIntIds.has(intId)) {
      intId = (intId + 1) & 0x7fffffff;
    }
    usedIntIds.add(intId);
    assigned.set(item.id, intId);
  }

  return assigned;
}

/**
 * Cleanly formats optional event details into Arabic without empty labels.
 */
function formatEventMetadata(evt: CalendarEvent): string {
  const parts: string[] = [];
  if (evt.course) parts.push(`مادة: ${evt.course}`);
  const instructor = evt.doctor_or_ta || evt.instructor;
  if (instructor) parts.push(`مع: ${instructor}`);
  if (evt.location) parts.push(`المكان: ${evt.location}`);
  return parts.join(' • ');
}

class ReminderEngineClass {
  private tickerIntervalId: number | null = null;
  private firedTriggerIds: Set<string> = new Set();
  private isLoaded = false;
  private onNotificationCallback: ((notif: NotificationItem) => void) | null = null;
  private channelConfigured = false;

  /**
   * Configures the Android Notification Channel with IMPORTANCE_HIGH (4), custom sound, and vibration
   * so local scheduled notifications produce audible notifications with custom azbotha_notification.ogg.
   */
  async ensureNotificationChannel(): Promise<void> {
    if (this.channelConfigured) return;

    try {
      if (typeof window === 'undefined') return;

      const { channels } = await LocalNotifications.listChannels();
      const existing = channels.find((c) => c.id === REMINDER_CHANNEL_ID);

      // If it exists and already has proper audible importance (>= 4), avoid duplicate creation
      if (existing && existing.importance !== undefined && existing.importance >= 4) {
        this.channelConfigured = true;
        return;
      }

      // If existing channel had low importance, delete it to recreate
      if (existing) {
        try {
          await LocalNotifications.deleteChannel({ id: REMINDER_CHANNEL_ID });
        } catch {
          // ignore
        }
      }

      // Clean up legacy v1 and older channels if present
      for (const oldId of ['reminders_channel', 'reminders_audible_channel', 'azbatha_reminders_audible_v1']) {
        if (channels.some((c) => c.id === oldId)) {
          try {
            await LocalNotifications.deleteChannel({ id: oldId });
          } catch {
            // ignore
          }
        }
      }

      // Create new channel with High Importance (4) and custom azbotha_notification.ogg sound
      await LocalNotifications.createChannel({
        id: REMINDER_CHANNEL_ID,
        name: 'تنبيهات ومواعيد ازبطها',
        description: 'إشعارات صوتية مخصصة للتذكير بمواعيدك ومهامك اليومية',
        importance: 4, // IMPORTANCE_HIGH: plays sound and displays notification in shade & heads-up
        visibility: 1, // VISIBILITY_PUBLIC: shows on lockscreen
        sound: REMINDER_SOUND,
        vibration: true,
        lights: true,
        lightColor: '#243B35',
      });

      this.channelConfigured = true;
    } catch (e) {
      console.warn('Notification channel setup failed or not supported in this environment:', e);
    }
  }

  /**
   * Load previously fired trigger IDs from IndexedDB metadata to persist across browser refreshes.
   */
  async initialize(): Promise<void> {
    if (this.isLoaded) return;
    try {
      const saved = await indexedDBRepository.getMetadata<string[]>(FIRED_REMINDERS_KEY);
      if (Array.isArray(saved)) {
        this.firedTriggerIds = new Set(saved);
      }
      await this.ensureNotificationChannel().catch(() => {});
    } catch {
      // Fallback to empty
    } finally {
      this.isLoaded = true;
    }
  }

  private async saveFiredSet(): Promise<void> {
    try {
      const list = Array.from(this.firedTriggerIds).slice(-500);
      await indexedDBRepository.setMetadata(FIRED_REMINDERS_KEY, list);
    } catch {
      // Ignore
    }
  }

  /**
   * Checks Android 12+ Exact Notification / Alarm setting status.
   */
  async checkExactNotificationSetting(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
        const res = await LocalNotifications.checkExactNotificationSetting();
        return res.exact_alarm === 'granted';
      }
    } catch (e) {
      console.warn('Exact alarm check not supported or failed:', e);
    }
    return true;
  }

  /**
   * Opens Android OS settings screen to allow SCHEDULE_EXACT_ALARM.
   */
  async changeExactNotificationSetting(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
        await LocalNotifications.changeExactNotificationSetting();
      }
    } catch (e) {
      console.warn('Change exact notification setting failed:', e);
    }
  }

  /**
   * Returns exact alarm permission status ('granted', 'denied', or 'unsupported').
   */
  async getExactAlarmStatus(): Promise<'granted' | 'denied' | 'unsupported'> {
    try {
      if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
        const res = await LocalNotifications.checkExactNotificationSetting();
        return res.exact_alarm === 'granted' ? 'granted' : 'denied';
      }
    } catch {
      // Not on Android 12+ or unsupported
    }
    return 'unsupported';
  }

  /**
   * User-initiated request for native/browser Notification permission.
   */
  async requestNotificationPermission(): Promise<boolean> {
    try {
      // Native Capacitor permission check & request
      const permResult = await LocalNotifications.requestPermissions();

      // Android 12+ check for Exact Alarms
      if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
        try {
          const canSchedule = await LocalNotifications.checkExactNotificationSetting();
          if (canSchedule.exact_alarm !== 'granted') {
            await LocalNotifications.changeExactNotificationSetting().catch(() => {});
          }
        } catch {
          // ignore exact alarm check errors if not supported
        }
      }

      if (permResult.display === 'granted') {
        await this.ensureNotificationChannel();
        // Clear local cache to force full re-sync to OS on permission grant
        await indexedDBRepository.setMetadata('native_scheduled_triggers', null);
        this.checkAndFireReminders().catch(() => {});
        return true;
      }
    } catch {
      // Fallback to browser HTML5 notifications
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        this.checkAndFireReminders().catch(() => {});
        return true;
      }
    }
    return false;
  }

  /**
   * Asynchronously checks native Android or Web notification permission status.
   */
  async getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    try {
      if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
        const { display } = await LocalNotifications.checkPermissions();
        if (display === 'granted') return 'granted';
        if (display === 'denied') return 'denied';
        if (display === 'prompt' || display === 'prompt-with-rationale') return 'prompt';
      }
    } catch {
      // fallback to browser
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return 'prompt';
  }

  /**
   * Schedules a test notification to fire in `delaySeconds` (default 10 seconds).
   * Verifies audio channel, sound playback, and notification delivery.
   */
  async scheduleTestNotification(delaySeconds = 10): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureNotificationChannel();
      const testDate = new Date(Date.now() + delaySeconds * 1000);
      const testId = hashStringToInt(`test_notif_${Date.now()}`);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: testId,
            title: 'تجربة تنبيه ازبطها 🔔',
            body: 'الصوت والإشعار شغالين تمام! كل مواعيدك ومهامك في أمان 🚀',
            channelId: REMINDER_CHANNEL_ID,
            sound: REMINDER_SOUND,
            schedule: { at: testDate, allowWhileIdle: true },
            extra: { type: 'test' },
          },
        ],
      });

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Test notification schedule error:', msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Start the periodic ticker loop (every 25 seconds).
   */
  startTicker(onNotificationFired?: (notif: NotificationItem) => void): void {
    if (onNotificationFired) {
      this.onNotificationCallback = onNotificationFired;
    }

    if (this.tickerIntervalId !== null) return;

    // Run immediate check and schedule native OS reminders
    this.checkAndFireReminders().catch(() => {});

    // Schedule 25s ticker
    this.tickerIntervalId = window.setInterval(() => {
      this.checkAndFireReminders().catch(() => {});
    }, 25000) as unknown as number;
  }

  stopTicker(): void {
    if (this.tickerIntervalId !== null) {
      clearInterval(this.tickerIntervalId);
      this.tickerIntervalId = null;
    }
  }

  /**
   * Main reminder evaluation and synchronization method.
   * Compares active planner data, cancels stale/ghost notifications, and schedules valid future triggers.
   */
  async checkAndFireReminders(): Promise<void> {
    await this.initialize();

    const [events, tasks, thoughts, prefs] = await Promise.all([
      indexedDBRepository.getAllEvents(),
      indexedDBRepository.getAllTasks(),
      indexedDBRepository.getAllReminders(),
      indexedDBRepository.getPreferences(),
    ]);

    const userTimezone = prefs?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
    const nowMs = Date.now();
    const triggers: ReminderTrigger[] = [];

    // 1. Evaluate Timed & Untimed Events
    for (const evt of events) {
      if (evt.completed || evt.status === 'completed' || evt.status === 'cancelled') {
        continue;
      }
      if (evt.reminder === false) continue;

      const evtTriggers = this.calculateEventTriggers(evt, userTimezone);
      triggers.push(...evtTriggers);
    }

    // 2. Evaluate Tasks
    for (const task of tasks) {
      if (task.completed || task.status === 'completed') {
        continue;
      }
      if (task.reminder === false) continue;

      const taskTriggers = this.calculateTaskTriggers(task, userTimezone);
      triggers.push(...taskTriggers);
    }

    // 3. Evaluate Quick Thoughts / Reminders with `scheduled_for`
    for (const th of thoughts) {
      if (th.status === 'fired' || th.status === 'dismissed') {
        continue;
      }
      const thTriggers = this.calculateThoughtTriggers(th);
      triggers.push(...thTriggers);
    }

    // --- Native Android AlarmManager Scheduling & Cancellation ---
    // 45 days forward horizon, prioritizing earliest triggers, capped at MAX_SCHEDULED_NOTIFICATIONS (400)
    const horizonMs = nowMs + REMINDER_HORIZON_DAYS * 24 * 60 * 60 * 1000;
    const futureTriggers = triggers
      .filter((t) => t.triggerTime > nowMs && t.triggerTime <= horizonMs)
      .sort((a, b) => a.triggerTime - b.triggerTime)
      .slice(0, MAX_SCHEDULED_NOTIFICATIONS);

    // Compute unique notification IDs for all future triggers
    const triggerIdMap = assignUniqueNotificationIds(futureTriggers);

    // Fetch previously scheduled triggers
    const prevScheduled = (await indexedDBRepository.getMetadata<ScheduledTriggerRecord[]>('native_scheduled_triggers')) || [];

    // Triggers that need to be scheduled (new or modified trigger time, title, or body)
    const triggersToSchedule = futureTriggers.filter((t) => {
      const prev = prevScheduled.find((p) => p.id === t.id);
      return !prev || prev.triggerTime !== t.triggerTime || prev.title !== t.title || prev.body !== t.body;
    });

    // Triggers that need to be cancelled:
    // Any previously scheduled trigger that is no longer in futureTriggers OR whose trigger time, title, or body has changed
    const triggersToCancel = prevScheduled.filter((p) => {
      const current = futureTriggers.find((f) => f.id === p.id);
      return !current || current.triggerTime !== p.triggerTime || current.title !== p.title || current.body !== p.body;
    });

    const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
    let allSuccessful = true;

    // Cancel stale / modified triggers from Android AlarmManager
    if (triggersToCancel.length > 0) {
      try {
        await LocalNotifications.cancel({
          notifications: triggersToCancel.map((t) => ({ id: t.notificationId ?? hashStringToInt(t.id) })),
        });
      } catch (err) {
        console.warn('Native notification cancellation error:', err);
        if (isNative) {
          allSuccessful = false;
        }
      }
    }

    // Schedule new / modified triggers to Android AlarmManager
    if (triggersToSchedule.length > 0) {
      try {
        await this.ensureNotificationChannel();
        await LocalNotifications.schedule({
          notifications: triggersToSchedule.map((t) => {
            const intId = triggerIdMap.get(t.id) ?? hashStringToInt(t.id);
            return {
              id: intId,
              title: t.title,
              body: t.body,
              channelId: REMINDER_CHANNEL_ID,
              sound: REMINDER_SOUND,
              schedule: { at: new Date(t.triggerTime), allowWhileIdle: true },
              extra: { entityId: t.entityId, entityType: t.entityType },
            };
          }),
        });
      } catch (e) {
        console.error('Native notification schedule error:', e);
        if (isNative) {
          allSuccessful = false;
        }
      }
    }

    // Persist new active set when operations succeed (or in web environment)
    if (allSuccessful || !isNative) {
      await indexedDBRepository.setMetadata(
        'native_scheduled_triggers',
        futureTriggers.map((t) => ({
          id: t.id,
          triggerTime: t.triggerTime,
          title: t.title,
          body: t.body,
          notificationId: triggerIdMap.get(t.id) ?? hashStringToInt(t.id),
        }))
      );
    }

    // Process all pending triggers for in-app / web fallback
    let newTriggersFired = false;

    for (const trigger of triggers) {
      if (this.firedTriggerIds.has(trigger.id)) {
        continue;
      }

      const diffMs = nowMs - trigger.triggerTime;

      // Case A: Due now (within 0 - 3 minutes)
      if (diffMs >= 0 && diffMs <= 3 * 60 * 1000) {
        await this.fireTrigger(trigger);
        this.firedTriggerIds.add(trigger.id);
        newTriggersFired = true;
      }
      // Case B: Missed reminder (within 3 mins - 12 hours)
      else if (diffMs > 3 * 60 * 1000 && diffMs <= 12 * 60 * 60 * 1000) {
        await this.fireTrigger(trigger, true /* isCatchup */);
        this.firedTriggerIds.add(trigger.id);
        newTriggersFired = true;
      }
      // Case C: Older than 12 hours -> mark fired
      else if (diffMs > 12 * 60 * 60 * 1000) {
        this.firedTriggerIds.add(trigger.id);
        newTriggersFired = true;
      }
    }

    if (newTriggersFired) {
      await this.saveFiredSet();
    }

    // Schedule rolling 14-day 5 PM tomorrow summary notifications
    await this.scheduleRollingDailySummaries(events, tasks);
  }

  /**
   * Maintains a rolling 14-day schedule of 5:00 PM tomorrow-summary notifications.
   * Runs natively via Capacitor LocalNotifications so notifications fire even if app is closed.
   */
  async scheduleRollingDailySummaries(events: CalendarEvent[], tasks: TaskItem[]): Promise<void> {
    try {
      const now = new Date();
      const desiredSummaries: Array<{
        id: number;
        title: string;
        body: string;
        triggerDate: Date;
        targetTomorrowStr: string;
      }> = [];

      // Check upcoming 14 days for 5 PM notifications
      for (let dayOffset = 0; dayOffset < DAILY_SUMMARY_HORIZON_DAYS; dayOffset++) {
        const triggerDate = new Date();
        triggerDate.setDate(now.getDate() + dayOffset);
        triggerDate.setHours(17, 0, 0, 0); // 5:00 PM local time

        // Skip if 5:00 PM for today has already passed
        if (triggerDate.getTime() <= now.getTime()) {
          continue;
        }

        // The day being summarized is "tomorrow" relative to the 5 PM triggerDate
        const tomorrowDate = new Date(triggerDate);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);

        const year = tomorrowDate.getFullYear();
        const month = String(tomorrowDate.getMonth() + 1).padStart(2, '0');
        const day = String(tomorrowDate.getDate()).padStart(2, '0');
        const targetTomorrowStr = `${year}-${month}-${day}`;

        // Find active uncompleted events for tomorrow
        const tomorrowEvents = events.filter((evt) => {
          if (evt.completed || evt.status === 'completed' || evt.status === 'cancelled') {
            return false;
          }
          const dStr = evt.date || evt.start_time;
          return dStr === targetTomorrowStr;
        });

        // Find active uncompleted tasks for tomorrow
        const tomorrowTasks = tasks.filter((task) => {
          if (task.completed || task.status === 'completed') {
            return false;
          }
          const dStr = task.due_date || task.date;
          return dStr === targetTomorrowStr;
        });

        const items: string[] = [];

        // Events list
        for (const evt of tomorrowEvents) {
          const timeStr = evt.time || evt.start_time;
          const coursePart = evt.course ? ` (${evt.course})` : '';
          if (timeStr && timeStr.includes(':')) {
            items.push(`${evt.title}${coursePart} الساعة ${timeStr}`);
          } else {
            items.push(`${evt.title}${coursePart}`);
          }
        }

        // Tasks list
        for (const task of tomorrowTasks) {
          if (task.due_time && task.due_time.includes(':')) {
            items.push(`${task.title} الساعة ${task.due_time}`);
          } else {
            items.push(task.title);
          }
        }

        // If nothing scheduled for tomorrow, do not schedule an empty summary
        if (items.length === 0) {
          continue;
        }

        const count = items.length;
        let countWord = '';
        if (count === 1) countWord = 'حاجة واحدة';
        else if (count === 2) countWord = 'حاجتين';
        else if (count >= 3 && count <= 10) countWord = `${count} حاجات`;
        else countWord = `${count} حاجة`;

        let bodyText = `بكرة عندك ${countWord}: `;
        if (count === 1) {
          bodyText += items[0] + '.';
        } else {
          const initial = items.slice(0, -1).join('، ');
          const last = items[items.length - 1];
          bodyText += `${initial}، و${last}.`;
        }

        const notifId = hashStringToInt(`azbotha_summary_5pm_${targetTomorrowStr}`);

        desiredSummaries.push({
          id: notifId,
          title: 'وراك بكرة 👀',
          body: bodyText,
          triggerDate,
          targetTomorrowStr,
        });
      }

      // Fetch previously scheduled summary notification IDs
      const prevSummaryIds = (await indexedDBRepository.getMetadata<number[]>('scheduled_daily_summary_ids')) || [];

      // Cancel summaries no longer in desired set
      const toCancel = prevSummaryIds.filter((id) => !desiredSummaries.some((d) => d.id === id));
      if (toCancel.length > 0) {
        try {
          await LocalNotifications.cancel({
            notifications: toCancel.map((id) => ({ id })),
          });
        } catch {
          // ignore
        }
      }

      // Schedule or refresh current desired summaries
      if (desiredSummaries.length > 0) {
        await this.ensureNotificationChannel();
        await LocalNotifications.schedule({
          notifications: desiredSummaries.map((s) => ({
            id: s.id,
            title: s.title,
            body: s.body,
            channelId: REMINDER_CHANNEL_ID,
            sound: REMINDER_SOUND,
            schedule: { at: s.triggerDate, allowWhileIdle: true },
            extra: { type: 'daily_summary_5pm', targetDate: s.targetTomorrowStr },
          })),
        });
      }

      // Save scheduled summary IDs
      await indexedDBRepository.setMetadata(
        'scheduled_daily_summary_ids',
        desiredSummaries.map((d) => d.id)
      );
    } catch (err) {
      console.warn('Rolling daily summary schedule error:', err);
    }
  }

  /**
   * Explicitly cancels any scheduled native notification associated with a specific entityId immediately.
   */
  async cancelEntityReminders(entityId: string): Promise<void> {
    try {
      const prevScheduled = (await indexedDBRepository.getMetadata<ScheduledTriggerRecord[]>('native_scheduled_triggers')) || [];
      const matching = prevScheduled.filter((p) => p.id.startsWith(`${entityId}_`));
      if (matching.length > 0) {
        try {
          await LocalNotifications.cancel({
            notifications: matching.map((t) => ({ id: t.notificationId ?? hashStringToInt(t.id) })),
          });
        } catch (e) {
          console.warn('cancelEntityReminders error:', e);
        }
        const remaining = prevScheduled.filter((p) => !p.id.startsWith(`${entityId}_`));
        await indexedDBRepository.setMetadata('native_scheduled_triggers', remaining);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Calculates reminder triggers for a CalendarEvent with rich Arabic content.
   */
  private calculateEventTriggers(evt: CalendarEvent, userTimezone: string): ReminderTrigger[] {
    const list: ReminderTrigger[] = [];
    const eventDateStr = evt.date || evt.start_time;
    if (!eventDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(eventDateStr)) {
      return list;
    }

    const hasTime = Boolean(evt.time || evt.start_time);

    if (hasTime) {
      const timeStr = evt.time || evt.start_time || '09:00';
      const eventStartMs = this.parseDateTimeToMs(eventDateStr, timeStr, userTimezone);

      if (isNaN(eventStartMs)) return list;

      const title = evt.title;
      const metadata = formatEventMetadata(evt);
      const metaSuffix = metadata ? ` (${metadata})` : '';
      const isUrgent = evt.priority === 'urgent' || evt.priority === 'high';

      // 1. Two hours before
      const ms2h = eventStartMs - 2 * 60 * 60 * 1000;
      list.push({
        id: `${evt.id}_evt_2h`,
        entityId: evt.id,
        entityType: 'event',
        triggerTime: ms2h,
        title: `تذكير بموعد: ${title}`,
        body: evt.category === 'lecture'
          ? `فاضل ساعتين على موعد محاضرتك الساعة ${timeStr}${metaSuffix}. جهز نفسك براحتك!`
          : `فاضل ساعتين على موعد: ${title} الساعة ${timeStr}${metaSuffix}.`,
        notificationType: 'upcoming',
      });

      // 2. One hour before
      const ms1h = eventStartMs - 1 * 60 * 60 * 1000;
      const urgentTag = isUrgent ? ' ⚡ عاجل' : '';
      list.push({
        id: `${evt.id}_evt_1h`,
        entityId: evt.id,
        entityType: 'event',
        triggerTime: ms1h,
        title: `يلا نجهز، فاضل ساعة!`,
        body: `فاضل ساعة على موعد: ${title} الساعة ${timeStr}${urgentTag}${metaSuffix}.`,
        notificationType: 'upcoming',
      });

      // 3. At time
      list.push({
        id: `${evt.id}_evt_at_time`,
        entityId: evt.id,
        entityType: 'event',
        triggerTime: eventStartMs,
        title: `حان الآن موعد: ${title}`,
        body: metadata
          ? `${isUrgent ? '⚡ ' : ''}${metadata} — بالتوفيق!`
          : `${isUrgent ? '⚡ ' : ''}حان موعدك الآن الساعة ${timeStr}. بالتوفيق!`,
        notificationType: 'upcoming',
      });
    } else {
      // Untimed Date-based event
      // Day-before evening reminder at 20:00
      const dayBeforeMs = this.getPreviousDayMs(eventDateStr, '20:00', userTimezone);
      if (!isNaN(dayBeforeMs)) {
        list.push({
          id: `${evt.id}_evt_day_before`,
          entityId: evt.id,
          entityType: 'event',
          triggerTime: dayBeforeMs,
          title: `استعداد لبكرة 🌙`,
          body: `بكرة عندك: ${evt.title}، بص عليه قبل ما تنام.`,
          notificationType: 'tomorrow',
        });
      }

      // Morning of event at 08:30 AM
      const morningMs = this.parseDateTimeToMs(eventDateStr, '08:30', userTimezone);
      if (!isNaN(morningMs)) {
        list.push({
          id: `${evt.id}_evt_morning`,
          entityId: evt.id,
          entityType: 'event',
          triggerTime: morningMs,
          title: `صباح الخير ☀️`,
          body: `النهاردة عندك: ${evt.title}. يومك موفق!`,
          notificationType: 'morning',
        });
      }
    }

    return list;
  }

  /**
   * Calculates reminder triggers for a TaskItem with rich Arabic content.
   */
  private calculateTaskTriggers(task: TaskItem, userTimezone: string): ReminderTrigger[] {
    const list: ReminderTrigger[] = [];
    const dueStr = task.due_date || task.date;
    if (!dueStr || !/^\d{4}-\d{2}-\d{2}$/.test(dueStr)) {
      return list;
    }

    const taskMeta: string[] = [];
    if (task.category && task.category !== 'عام') taskMeta.push(task.category);
    const notes = task.notes || task.description;
    if (notes) taskMeta.push(notes);
    const metaSuffix = taskMeta.length > 0 ? ` [${taskMeta.join(' • ')}]` : '';

    if (task.due_time) {
      const taskStartMs = this.parseDateTimeToMs(dueStr, task.due_time, userTimezone);
      if (!isNaN(taskStartMs)) {
        // 1 hour before due time
        const ms1h = taskStartMs - 60 * 60 * 1000;
        list.push({
          id: `${task.id}_task_1h`,
          entityId: task.id,
          entityType: 'task',
          triggerTime: ms1h,
          title: task.priority === 'urgent' ? `مهمة عاجلة مستنياك ⚡` : `تذكير بمهمة`,
          body: `فاضل ساعة على إنجاز: "${task.title}"${metaSuffix}. يلا تخلصها وتفضي بالك!`,
          notificationType: 'task',
        });
      }
    } else {
      // Date-only task -> Day-before evening 20:00
      const dayBeforeMs = this.getPreviousDayMs(dueStr, '20:00', userTimezone);
      if (!isNaN(dayBeforeMs)) {
        list.push({
          id: `${task.id}_task_day_before`,
          entityId: task.id,
          entityType: 'task',
          triggerTime: dayBeforeMs,
          title: `تذكير لمهام بكرة 📋`,
          body: `بكرة عندك شوية حاجات منها: "${task.title}"${metaSuffix}، بص عليهم قبل ما تنام.`,
          notificationType: 'tomorrow',
        });
      }
    }

    return list;
  }

  /**
   * Calculates reminder triggers for QuickThoughts / Reminders with `scheduled_for`.
   */
  private calculateThoughtTriggers(th: QuickThought): ReminderTrigger[] {
    const list: ReminderTrigger[] = [];
    if (!th.scheduled_for) return list;

    const schedMs = new Date(th.scheduled_for).getTime();
    if (!isNaN(schedMs)) {
      list.push({
        id: `${th.id}_thought_sched`,
        entityId: th.id,
        entityType: 'thought',
        triggerTime: schedMs,
        title: th.title || 'ملاحظة سريعة 💡',
        body: th.text || 'تذكير بملاحظتك المسجلة.',
        notificationType: 'reminder',
      });
    }

    return list;
  }

  /**
   * Deliver the reminder notification to:
   * 1. Audio sound chime (if enabled)
   * 2. Browser Native Notification (if permission granted)
   * 3. In-App Notification Record in IndexedDB repository
   */
  private async fireTrigger(trigger: ReminderTrigger, isCatchup = false): Promise<void> {
    const timeStr = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const notifItem: NotificationItem = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: isCatchup ? `تذكير سابق: ${trigger.title}` : trigger.title,
      subtitle: trigger.body,
      time: timeStr,
      type: trigger.notificationType,
      relatedId: trigger.entityId,
      read: false,
      created_at: new Date().toISOString(),
    };

    // 1. Play subtle audio chime if active and not catchup overload
    if (!isCatchup) {
      try {
        sound.playPop();
      } catch {
        // ignore
      }
    }

    // 2. Deliver browser native Notification IF explicit permission was granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(notifItem.title, {
          body: notifItem.subtitle,
          icon: '/logo.png',
          dir: 'rtl',
          lang: 'ar',
          silent: false,
        });
      } catch {
        // Native notification delivery fallback
      }
    }

    // 3. Persist into IndexedDB Notifications Repository
    try {
      await indexedDBRepository.saveNotification(notifItem);
    } catch {
      // ignore
    }

    // 4. Notify active UI listeners
    if (this.onNotificationCallback) {
      try {
        this.onNotificationCallback(notifItem);
      } catch {
        // ignore
      }
    }
  }

  // --- Helper Date & Time Parser Functions ---

  private parseDateTimeToMs(dateStr: string, timeStr: string, timezoneStr: string = 'Africa/Cairo'): number {
    try {
      if (!dateStr || typeof dateStr !== 'string') return NaN;
      const combined = combineDateAndTime(dateStr, timeStr);
      return combined.getTime();
    } catch {
      return NaN;
    }
  }

  private getPreviousDayMs(dateStr: string, timeStr: string, timezoneStr: string = 'Africa/Cairo'): number {
    try {
      if (!dateStr || typeof dateStr !== 'string') return NaN;
      const baseDate = parseCalendarDate(dateStr);
      baseDate.setDate(baseDate.getDate() - 1);
      const prevDateStr = formatCalendarDate(baseDate);
      return this.parseDateTimeToMs(prevDateStr, timeStr, timezoneStr);
    } catch {
      return NaN;
    }
  }
}

export const ReminderEngine = new ReminderEngineClass();
