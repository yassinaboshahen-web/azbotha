import { CalendarEvent, TaskItem, QuickThought, NotificationItem } from '../types';
import { indexedDBRepository } from '../repositories/indexedDBRepository';
import { sound } from '../utils/audio';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface ReminderTrigger {
  id: string; // Unique trigger ID: `${entityId}_${triggerKey}`
  entityId: string;
  entityType: 'event' | 'task' | 'thought';
  triggerTime: number; // UTC timestamp in milliseconds
  title: string;
  body: string;
  notificationType: 'upcoming' | 'task' | 'tomorrow' | 'reminder' | 'morning' | 'evening' | 'general';
}

export const REMINDER_CHANNEL_ID = 'azbatha_reminders_audible_v1';

const FIRED_REMINDERS_KEY = 'fired_reminders_set';

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash | 0);
}

class ReminderEngineClass {
  private tickerIntervalId: number | null = null;
  private firedTriggerIds: Set<string> = new Set();
  private isLoaded = false;
  private onNotificationCallback: ((notif: NotificationItem) => void) | null = null;
  private channelConfigured = false;

  /**
   * Configures the Android Notification Channel with IMPORTANCE_HIGH (4) and sound/vibration
   * so local scheduled notifications produce normal audible notifications in the Android notification shade.
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

      // If it exists but was configured with low/silent importance (< 4), delete it first to allow upgrade
      if (existing) {
        try {
          await LocalNotifications.deleteChannel({ id: REMINDER_CHANNEL_ID });
        } catch {
          // ignore
        }
      }

      // Clean up legacy channels if present
      for (const oldId of ['reminders_channel', 'reminders_audible_channel']) {
        if (channels.some((c) => c.id === oldId)) {
          try {
            await LocalNotifications.deleteChannel({ id: oldId });
          } catch {
            // ignore
          }
        }
      }

      // Create channel with High Importance (4) - plays device's default notification sound and shows in shade
      await LocalNotifications.createChannel({
        id: REMINDER_CHANNEL_ID,
        name: 'تنبيهات ومواعيد ازبطها',
        description: 'إشعارات صوتية للتذكير بمواعيدك ومهامك اليومية',
        importance: 4, // IMPORTANCE_HIGH: plays sound and displays notification in shade & heads-up
        visibility: 1, // VISIBILITY_PUBLIC: shows on lockscreen
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
      // Keep set size reasonable (limit to last 500 triggers)
      const list = Array.from(this.firedTriggerIds).slice(-500);
      await indexedDBRepository.setMetadata(FIRED_REMINDERS_KEY, list);
    } catch {
      // Ignore
    }
  }

  /**
   * User-initiated request for browser/Native Notification permission.
   * NEVER called automatically on page load.
   */
  async requestNotificationPermission(): Promise<boolean> {
    try {
      // Try native Capacitor permission first
      const permResult = await LocalNotifications.requestPermissions();
      
      // Android 12+ check for Exact Alarms
      if (typeof window !== 'undefined' && 'navigator' in window && (navigator as any).userAgent.includes('Android')) {
        const canSchedule = await LocalNotifications.checkExactNotificationSetting();
        if (canSchedule.exact_alarm !== 'granted') {
            await LocalNotifications.changeExactNotificationSetting();
        }
      }

      if (permResult.display === 'granted') {
        // Ensure audible channel is created immediately upon permission grant
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

  getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
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
   * Main reminder evaluation method. Checks events, tasks, and quick thoughts against current time.
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
      // Respect reminder: false
      if (evt.reminder === false) continue;

      const evtTriggers = this.calculateEventTriggers(evt, userTimezone);
      triggers.push(...evtTriggers);
    }

    // 2. Evaluate Tasks
    for (const task of tasks) {
      if (task.completed || task.status === 'completed') {
        continue;
      }
      // Respect reminder: false (default to true)
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

    // --- Optimized Native Scheduling Logic ---
    const horizonMs = nowMs + 14 * 24 * 60 * 60 * 1000;
    const futureTriggers = triggers
      .filter(t => t.triggerTime > nowMs && t.triggerTime < horizonMs)
      .sort((a, b) => a.triggerTime - b.triggerTime)
      .slice(0, 60);

    // Fetch previously scheduled triggers to compare
    const prevScheduled = await indexedDBRepository.getMetadata<{id: string, triggerTime: number}[]>('native_scheduled_triggers') || [];

    const triggersToSchedule = futureTriggers.filter(t => {
        const prev = prevScheduled.find(p => p.id === t.id);
        return !prev || prev.triggerTime !== t.triggerTime;
    });

    const triggersToCancel = prevScheduled.filter(p => !futureTriggers.find(f => f.id === p.id));

    let allSuccessful = true;

    if (triggersToCancel.length > 0) {
        try {
            await LocalNotifications.cancel({
                notifications: triggersToCancel.map(t => ({ id: hashStringToInt(t.id) })),
            });
        } catch {
            allSuccessful = false;
        }
    }

    if (triggersToSchedule.length > 0) {
        try {
            await this.ensureNotificationChannel();
            await LocalNotifications.schedule({
                notifications: triggersToSchedule.map(t => ({
                    id: hashStringToInt(t.id),
                    title: t.title,
                    body: t.body,
                    channelId: REMINDER_CHANNEL_ID,
                    schedule: { at: new Date(t.triggerTime), allowWhileIdle: true },
                    extra: { entityId: t.entityId, entityType: t.entityType },
                })),
            });
        } catch (e) {
            console.error('Schedule error:', e);
            allSuccessful = false;
        }
    }

    // Persist new set ONLY if all scheduling operations succeeded
    if (allSuccessful) {
        await indexedDBRepository.setMetadata('native_scheduled_triggers', futureTriggers.map(t => ({id: t.id, triggerTime: t.triggerTime})));
    }

    // Process all pending triggers (local web fallback/catchup evaluation)
    let newTriggersFired = false;

    for (const trigger of triggers) {
      if (this.firedTriggerIds.has(trigger.id)) {
        continue; // Skip already fired
      }

      const diffMs = nowMs - trigger.triggerTime;

      // Case A: Trigger time reached or due now (within 0 - 3 minutes)
      if (diffMs >= 0 && diffMs <= 3 * 60 * 1000) {
        await this.fireTrigger(trigger);
        this.firedTriggerIds.add(trigger.id);
        newTriggersFired = true;
      }
      // Case B: Missed reminder (occurred between 3 mins and 12 hours ago)
      else if (diffMs > 3 * 60 * 1000 && diffMs <= 12 * 60 * 60 * 1000) {
        await this.fireTrigger(trigger, true /* isCatchup */);
        this.firedTriggerIds.add(trigger.id);
        newTriggersFired = true;
      }
      // Case C: Expired (older than 12 hours) -> mark as fired to prevent spamming
      else if (diffMs > 12 * 60 * 60 * 1000) {
        this.firedTriggerIds.add(trigger.id);
        newTriggersFired = true;
      }
    }

    if (newTriggersFired) {
      await this.saveFiredSet();
    }

    // Schedule the Daily 5 PM summary notification natively via Capacitor
    await this.scheduleDailySummary(events, tasks, userTimezone);
  }

  /**
   * Schedules a daily 5 PM summary notification for tomorrow's events and tasks.
   * Runs natively via Capacitor LocalNotifications.
   */
  async scheduleDailySummary(events: CalendarEvent[], tasks: TaskItem[], userTimezone: string): Promise<void> {
    try {
      const DAILY_SUMMARY_NOTIFICATION_ID = 500500;

      // Calculate next 5:00 PM local time
      const now = new Date();
      const target = new Date();
      target.setHours(17, 0, 0, 0);

      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      // "Tomorrow" relative to target trigger time
      const summaryDay = new Date(target);
      summaryDay.setDate(summaryDay.getDate() + 1);
      
      const year = summaryDay.getFullYear();
      const month = String(summaryDay.getMonth() + 1).padStart(2, '0');
      const day = String(summaryDay.getDate()).padStart(2, '0');
      const tomorrowDateStr = `${year}-${month}-${day}`;

      // Filter events
      const tomorrowEvents = events.filter(evt => {
        if (evt.completed || evt.status === 'completed' || evt.status === 'cancelled') {
          return false;
        }
        const dateStr = evt.date || evt.start_time;
        return dateStr === tomorrowDateStr;
      });

      // Filter tasks
      const tomorrowTasks = tasks.filter(task => {
        if (task.completed || task.status === 'completed') {
          return false;
        }
        const dueStr = task.due_date || task.date;
        return dueStr === tomorrowDateStr;
      });

      // Cancel any existing summary notification first to prevent duplicates
      try {
        await LocalNotifications.cancel({
          notifications: [{ id: DAILY_SUMMARY_NOTIFICATION_ID }]
        });
      } catch {
        // ignore
      }

      const items: string[] = [];

      // Add events
      for (const evt of tomorrowEvents) {
        const timeStr = evt.time || evt.start_time;
        if (timeStr && timeStr.includes(':')) {
          items.push(`${evt.title} الساعة ${timeStr}`);
        } else {
          items.push(evt.title);
        }
      }

      // Add tasks
      for (const task of tomorrowTasks) {
        const timeStr = task.due_time;
        if (timeStr && timeStr.includes(':')) {
          items.push(`${task.title} الساعة ${timeStr}`);
        } else {
          items.push(task.title);
        }
      }

      if (items.length === 0) {
        return; // No items scheduled for tomorrow -> do not send
      }

      const count = items.length;
      let countWord = '';
      if (count === 1) countWord = 'حاجة واحدة';
      else if (count === 2) countWord = 'حاجتين';
      else if (count >= 3 && count <= 10) countWord = `${count} حاجات`;
      else countWord = `${count} حاجة`;

      let bodyText = `بكرا عندك ${countWord}: `;
      if (count === 1) {
        bodyText += items[0] + '.';
      } else {
        const initial = items.slice(0, -1).join('، ');
        const last = items[items.length - 1];
        bodyText += `${initial}، و${last}.`;
      }

      await this.ensureNotificationChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: DAILY_SUMMARY_NOTIFICATION_ID,
            title: "وراك بكرا 👀",
            body: bodyText,
            channelId: REMINDER_CHANNEL_ID,
            schedule: { at: target },
            extra: { type: 'tomorrow_summary' },
          }
        ]
      });
    } catch {
      // Ignore if not in Capacitor environment
    }
  }

  /**
   * Calculates reminder triggers for a CalendarEvent.
   */
  private calculateEventTriggers(evt: CalendarEvent, userTimezone: string): ReminderTrigger[] {
    const list: ReminderTrigger[] = [];
    const eventDateStr = evt.date || evt.start_time; // YYYY-MM-DD
    if (!eventDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(eventDateStr)) {
      return list;
    }

    const hasTime = Boolean(evt.time || evt.start_time);

    if (hasTime) {
      const timeStr = evt.time || evt.start_time || '09:00';
      const eventStartMs = this.parseDateTimeToMs(eventDateStr, timeStr, userTimezone);

      if (isNaN(eventStartMs)) return list;

      const title = evt.title;
      const course = evt.course ? ` (${evt.course})` : '';

      // 1. Two hours before
      const ms2h = eventStartMs - 2 * 60 * 60 * 1000;
      list.push({
        id: `${evt.id}_evt_2h`,
        entityId: evt.id,
        entityType: 'event',
        triggerTime: ms2h,
        title: `تذكير بموعد: ${title}`,
        body: evt.category === 'lecture'
          ? `اصحى براحتك، عندك محاضرة${course} الساعة ${timeStr}.`
          : `فاضل ساعتين على موعد: ${title}.`,
        notificationType: 'upcoming',
      });

      // 2. One hour before
      const ms1h = eventStartMs - 1 * 60 * 60 * 1000;
      list.push({
        id: `${evt.id}_evt_1h`,
        entityId: evt.id,
        entityType: 'event',
        triggerTime: ms1h,
        title: `يلا نجهز، فاضل ساعة!`,
        body: `فاضل ساعة على ${title} الساعة ${timeStr}.`,
        notificationType: 'upcoming',
      });

      // 3. At time
      list.push({
        id: `${evt.id}_evt_at_time`,
        entityId: evt.id,
        entityType: 'event',
        triggerTime: eventStartMs,
        title: `حان الآن موعد: ${title}`,
        body: evt.location ? `المكان: ${evt.location}` : `موفق إن شاء الله!`,
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
   * Calculates reminder triggers for a TaskItem.
   */
  private calculateTaskTriggers(task: TaskItem, userTimezone: string): ReminderTrigger[] {
    const list: ReminderTrigger[] = [];
    const dueStr = task.due_date || task.date;
    if (!dueStr || !/^\d{4}-\d{2}-\d{2}$/.test(dueStr)) {
      return list;
    }

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
          body: `فاضل ساعة على تسليم/إنجاز: "${task.title}". يلا تخلصها وتفضي بالك!`,
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
          body: `بكرة عندك شوية حاجات منها: "${task.title}"، بص عليهم قبل ما تنام.`,
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

  private parseDateTimeToMs(dateStr: string, timeStr: string, timezoneStr: string): number {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);

      // Construct a local ISO string approximation and parse in target timezone
      const formattedMonth = String(month).padStart(2, '0');
      const formattedDay = String(day).padStart(2, '0');
      const formattedHour = String(hour).padStart(2, '0');
      const formattedMin = String(minute).padStart(2, '0');

      const isoStr = `${year}-${formattedMonth}-${formattedDay}T${formattedHour}:${formattedMin}:00`;
      
      // Fallback standard parse
      return new Date(isoStr).getTime();
    } catch {
      return NaN;
    }
  }

  private getPreviousDayMs(dateStr: string, timeStr: string, timezoneStr: string): number {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      // Month is 0-indexed in Date constructor, so subtract 1
      const current = new Date(year, month - 1, day);
      current.setDate(current.getDate() - 1);
      
      const prevYear = current.getFullYear();
      const prevMonth = String(current.getMonth() + 1).padStart(2, '0');
      const prevDay = String(current.getDate()).padStart(2, '0');
      
      const prevDateStr = `${prevYear}-${prevMonth}-${prevDay}`;
      return this.parseDateTimeToMs(prevDateStr, timeStr, timezoneStr);
    } catch {
      return NaN;
    }
  }
}

export const ReminderEngine = new ReminderEngineClass();
