import { syncQueueRepository } from '../repositories/syncQueueRepository';
import { indexedDBRepository } from '../repositories/indexedDBRepository';
import { apiClient } from './apiClient';
import {
  SyncEntityType,
  SyncOperationKind,
  SyncOperationRecord,
  TaskItem,
  CalendarEvent,
  QuickThought,
  NotificationItem,
  UserPreferences,
} from '../types';

export type SyncStatusState = 'synced' | 'syncing' | 'offline_saved' | 'offline_retry';

export interface SyncStatusInfo {
  state: SyncStatusState;
  label: string;
  pendingCount: number;
  lastSyncedAt?: string;
}

const STATUS_LABELS: Record<SyncStatusState, string> = {
  synced: 'بياناتك محفوظة',
  syncing: 'بنزامن بياناتك...',
  offline_saved: 'اتحفظ عندك، وهنتزامن أول ما الاتصال يرجع.',
  offline_retry: 'في مشكلة في المزامنة، بس بياناتك المحلية محفوظة.',
};

let isSyncingActive = false;
let currentSyncState: SyncStatusState = 'synced';
let lastSyncedTime: string | undefined = undefined;
const statusListeners = new Set<(info: SyncStatusInfo) => void>();

function notifyStatusListeners(pendingCount: number = 0) {
  const info: SyncStatusInfo = {
    state: currentSyncState,
    label: STATUS_LABELS[currentSyncState],
    pendingCount,
    lastSyncedAt: lastSyncedTime,
  };
  statusListeners.forEach((listener) => {
    try {
      listener(info);
    } catch {
      // ignore listener error
    }
  });
}

export const SyncManager = {
  /**
   * Subscribe to subtle sync status changes.
   */
  subscribeStatus(listener: (info: SyncStatusInfo) => void): () => void {
    statusListeners.add(listener);
    // Notify immediate initial state
    syncQueueRepository.getPendingSyncOps().then((pending) => {
      listener({
        state: currentSyncState,
        label: STATUS_LABELS[currentSyncState],
        pendingCount: pending.length,
        lastSyncedAt: lastSyncedTime,
      });
    });
    return () => {
      statusListeners.delete(listener);
    };
  },

  getCurrentStatus(pendingCount: number = 0): SyncStatusInfo {
    return {
      state: currentSyncState,
      label: STATUS_LABELS[currentSyncState],
      pendingCount,
      lastSyncedAt: lastSyncedTime,
    };
  },

  /**
   * Fast health & network connectivity check.
   */
  async checkConnectivity(): Promise<boolean> {
    if (!apiClient.isCloudSyncEnabled()) return false;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const response = await fetch(`${apiBaseUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Enqueue a local mutation into IndexedDB sync_operations.
   * Runs immediately and never blocks UI execution.
   */
  async enqueueOperation(params: {
    entity_type: SyncEntityType;
    entity_id: string;
    operation_type: SyncOperationKind;
    payload: Record<string, unknown>;
  }): Promise<SyncOperationRecord | null> {
    if (!apiClient.isCloudSyncEnabled()) {
      return null;
    }

    const syncOp = await syncQueueRepository.enqueueSyncOp({
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      operation_type: params.operation_type,
      payload: params.payload,
    });

    const isConnected = await this.checkConnectivity();
    if (!isConnected) {
      currentSyncState = 'offline_saved';
      const pending = await syncQueueRepository.getPendingSyncOps();
      if (pending.length > 0) {
        currentSyncState = 'offline_retry';
      }
      notifyStatusListeners(pending.length);
    } else {
      // Trigger background sync cycle
      this.syncAll().catch(() => {});
    }

    return syncOp;
  },

  /**
   * Full bidirectional synchronization with Last-Write-Wins (LWW) conflict resolution.
   */
  async syncAll(): Promise<{
    tasks: TaskItem[];
    events: CalendarEvent[];
    reminders: QuickThought[];
    notifications: NotificationItem[];
    preferences: UserPreferences;
  }> {
    // 1. Get local cached records first
    let localTasks = await indexedDBRepository.getAllTasks();
    let localEvents = await indexedDBRepository.getAllEvents();
    let localReminders = await indexedDBRepository.getAllReminders();
    let localNotifications = await indexedDBRepository.getAllNotifications();
    let localPreferences = await indexedDBRepository.getPreferences();

    if (!apiClient.isCloudSyncEnabled()) {
      return {
        tasks: localTasks,
        events: localEvents,
        reminders: localReminders,
        notifications: localNotifications,
        preferences: localPreferences,
      };
    }

    const pendingOps = await syncQueueRepository.getPendingSyncOps();

    const isConnected = await this.checkConnectivity();

    if (!isConnected) {
      currentSyncState = pendingOps.length > 0 ? 'offline_retry' : 'offline_saved';
      notifyStatusListeners(pendingOps.length);
      return {
        tasks: localTasks,
        events: localEvents,
        reminders: localReminders,
        notifications: localNotifications,
        preferences: localPreferences,
      };
    }

    if (isSyncingActive) {
      return {
        tasks: localTasks,
        events: localEvents,
        reminders: localReminders,
        notifications: localNotifications,
        preferences: localPreferences,
      };
    }

    isSyncingActive = true;
    currentSyncState = 'syncing';
    notifyStatusListeners(pendingOps.length);

    try {
      // STEP A: Push local pending operations
      if (pendingOps.length > 0) {
        pendingOps.sort((a, b) => a.created_at.localeCompare(b.created_at));

        for (const op of pendingOps) {
          // Exponential backoff if previously failed
          if (op.status === 'failed' && op.last_attempt_at) {
            const lastAttempt = new Date(op.last_attempt_at).getTime();
            const backoffMs = Math.min(Math.pow(2, op.retry_count) * 1000, 30000);
            if (Date.now() - lastAttempt < backoffMs) {
              continue;
            }
          }

          await syncQueueRepository.updateSyncOpStatus(op.id, 'processing');

          try {
            await apiClient.pushSyncOperations([op]);
            await syncQueueRepository.markSyncOpSynced(op.id);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            await syncQueueRepository.markSyncOpFailed(op.id, errMsg);
          }
        }
      }

      // STEP B: Pull remote cloud changes
      const pendingAfterPush = await syncQueueRepository.getPendingSyncOps();
      const pendingEntityIds = new Set(pendingAfterPush.map((p) => p.entity_id));

      const cloudResponse = await apiClient.pullCloudChanges();
      const changes = cloudResponse?.changes || {};

      // 1. Process Tasks LWW
      if (Array.isArray(changes.tasks)) {
        for (const remoteTask of changes.tasks) {
          const tId = String(remoteTask.id);
          if (pendingEntityIds.has(tId)) {
            continue; // Skip: Local unpushed changes take priority until pushed
          }

          const localTask = localTasks.find((t) => t.id === tId);
          const remoteUpdated = remoteTask.updated_at || remoteTask.created_at || new Date().toISOString();
          const localUpdated = localTask?.updated_at || localTask?.created_at || '1970-01-01T00:00:00.000Z';

          if (!localTask || new Date(remoteUpdated).getTime() >= new Date(localUpdated).getTime()) {
            const rawTaskDate = remoteTask.due_date || remoteTask.date || localTask?.due_date || localTask?.date;
            const validTaskDate = (rawTaskDate && /^\d{4}-\d{2}-\d{2}$/.test(rawTaskDate)) ? rawTaskDate : undefined;

            const parsedTask: TaskItem = {
              id: tId,
              title: remoteTask.title || localTask?.title || '',
              description: remoteTask.description || localTask?.description || localTask?.notes || undefined,
              due_date: validTaskDate,
              due_time: remoteTask.due_time || localTask?.due_time || undefined,
              priority: remoteTask.priority || localTask?.priority || 'normal',
              status: remoteTask.status || localTask?.status || (remoteTask.completed ? 'completed' : 'pending'),
              completed: remoteTask.status === 'completed' || Boolean(remoteTask.completed) || Boolean(localTask?.completed),
              completed_at: remoteTask.completed_at || localTask?.completed_at || undefined,
              created_at: remoteTask.created_at || localTask?.created_at,
              updated_at: remoteTask.updated_at || localTask?.updated_at,
              category: remoteTask.category || localTask?.category || 'عام',
              date: validTaskDate,
              reminder: remoteTask.reminder !== undefined ? Boolean(remoteTask.reminder) : (localTask ? Boolean(localTask.reminder) : false),
              notes: remoteTask.notes || localTask?.notes || remoteTask.description || localTask?.description || '',
            };
            await indexedDBRepository.saveTask(parsedTask);
          }
        }
        localTasks = await indexedDBRepository.getAllTasks();
      }

      // 2. Process Events LWW
      if (Array.isArray(changes.events)) {
        for (const remoteEvt of changes.events) {
          const eId = String(remoteEvt.id);
          if (pendingEntityIds.has(eId)) {
            continue;
          }

          const localEvt = localEvents.find((e) => e.id === eId);
          const remoteUpdated = remoteEvt.updated_at || remoteEvt.created_at || new Date().toISOString();
          const localUpdated = localEvt?.updated_at || localEvt?.created_at || '1970-01-01T00:00:00.000Z';

          if (!localEvt || new Date(remoteUpdated).getTime() >= new Date(localUpdated).getTime()) {
            const rawEvtDate = remoteEvt.date || remoteEvt.event_date || localEvt?.date;
            const validEvtDate = (rawEvtDate && /^\d{4}-\d{2}-\d{2}$/.test(rawEvtDate)) ? rawEvtDate : (localEvt?.date || '');

            const parsedEvt: CalendarEvent = {
              id: eId,
              title: remoteEvt.title || localEvt?.title || '',
              date: validEvtDate,
              time: remoteEvt.start_time || remoteEvt.time || localEvt?.time || localEvt?.start_time || '09:00',
              start_time: remoteEvt.start_time || remoteEvt.time || localEvt?.start_time || localEvt?.time || '09:00',
              end_time: remoteEvt.end_time || remoteEvt.endTime || localEvt?.end_time || localEvt?.endTime || undefined,
              endTime: remoteEvt.end_time || remoteEvt.endTime || localEvt?.endTime || localEvt?.end_time || undefined,
              location: remoteEvt.location || localEvt?.location || undefined,
              doctor_or_ta: remoteEvt.doctor_or_ta || remoteEvt.person || remoteEvt.instructor || localEvt?.doctor_or_ta || localEvt?.instructor || undefined,
              instructor: remoteEvt.doctor_or_ta || remoteEvt.person || remoteEvt.instructor || localEvt?.instructor || localEvt?.doctor_or_ta || undefined,
              course: remoteEvt.course || localEvt?.course || undefined,
              notes: remoteEvt.notes || remoteEvt.description || localEvt?.notes || undefined,
              category: remoteEvt.category || localEvt?.category || 'custom',
              categoryLabel: remoteEvt.category_label || remoteEvt.categoryLabel || localEvt?.categoryLabel || 'معاد',
              reminder: remoteEvt.reminder !== undefined ? Boolean(remoteEvt.reminder) : (localEvt ? Boolean(localEvt.reminder) : false),
              priority: remoteEvt.priority || localEvt?.priority || 'normal',
              status: remoteEvt.status || localEvt?.status || (remoteEvt.completed ? 'completed' : 'upcoming'),
              completed: remoteEvt.status === 'completed' || Boolean(remoteEvt.completed) || Boolean(localEvt?.completed),
              created_at: remoteEvt.created_at || localEvt?.created_at,
              updated_at: remoteEvt.updated_at || localEvt?.updated_at,
            };
            await indexedDBRepository.saveEvent(parsedEvt);
          }
        }
        localEvents = await indexedDBRepository.getAllEvents();
      }

      // 3. Process Reminders LWW
      if (Array.isArray(changes.reminders)) {
        for (const remoteRem of changes.reminders) {
          const rId = String(remoteRem.id);
          if (pendingEntityIds.has(rId)) continue;

          const localRem = localReminders.find((r) => r.id === rId);
          const remoteUpdated = remoteRem.updated_at || remoteRem.created_at || new Date().toISOString();
          const localUpdated = localRem?.updated_at || localRem?.created_at || '1970-01-01T00:00:00.000Z';

          if (!localRem || new Date(remoteUpdated).getTime() >= new Date(localUpdated).getTime()) {
            let tc: any = {};
            if (remoteRem.trigger_configuration) {
              try {
                tc = typeof remoteRem.trigger_configuration === 'string'
                  ? JSON.parse(remoteRem.trigger_configuration)
                  : remoteRem.trigger_configuration;
              } catch {
                // ignore
              }
            }

            const parsedRem: QuickThought = {
              id: rId,
              title: tc.title || remoteRem.title || localRem?.title || undefined,
              text: tc.text || remoteRem.message || remoteRem.text || remoteRem.title || localRem?.text || undefined,
              scheduled_for: tc.scheduled_for || remoteRem.scheduled_for || localRem?.scheduled_for || undefined,
              date: tc.date || remoteRem.date || localRem?.date || undefined,
              pinned: tc.pinned !== undefined ? Boolean(tc.pinned) : (remoteRem.pinned !== undefined ? Boolean(remoteRem.pinned) : (localRem ? Boolean(localRem.pinned) : false)),
              status: remoteRem.status || localRem?.status || 'pending',
              type: remoteRem.type || localRem?.type || 'custom',
              created_at: remoteRem.created_at || localRem?.created_at,
              updated_at: remoteRem.updated_at || localRem?.updated_at,
            };
            await indexedDBRepository.saveReminder(parsedRem);
          }
        }
        localReminders = await indexedDBRepository.getAllReminders();
      }

      // 4. Process Notifications
      if (Array.isArray(changes.notifications)) {
        for (const remoteNotif of changes.notifications) {
          const nId = String(remoteNotif.id);
          if (pendingEntityIds.has(nId)) continue;

          const parsedNotif: NotificationItem = {
            id: nId,
            title: String(remoteNotif.title || ''),
            subtitle: String(remoteNotif.body || remoteNotif.subtitle || ''),
            time: remoteNotif.created_at ? new Date(remoteNotif.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'الآن',
            type: (remoteNotif.type as any) || 'general',
            read: Boolean(remoteNotif.read),
            created_at: remoteNotif.created_at,
          };
          await indexedDBRepository.saveNotification(parsedNotif);
        }
        localNotifications = await indexedDBRepository.getAllNotifications();
      }

      // 5. Process User Preferences
      if (changes.preferences) {
        const p = changes.preferences;
        localPreferences = await indexedDBRepository.savePreferences({
          id: 'default',
          timezone: String(p.timezone || localPreferences.timezone),
          locale: String(p.locale || localPreferences.locale),
          week_starts_on: (p.week_start_day as any) || (p.week_starts_on as any) || localPreferences.week_starts_on,
          default_view: (p.default_view as any) || localPreferences.default_view,
          reminder_preferences: typeof p.notification_preferences === 'string' ? JSON.parse(p.notification_preferences) : localPreferences.reminder_preferences,
          updated_at: new Date().toISOString(),
        });
      }

      lastSyncedTime = new Date().toISOString();
      const remainingPending = await syncQueueRepository.getPendingSyncOps();
      currentSyncState = remainingPending.length > 0 ? 'offline_retry' : 'synced';
      notifyStatusListeners(remainingPending.length);
    } catch {
      const remainingPending = await syncQueueRepository.getPendingSyncOps();
      currentSyncState = 'offline_retry';
      notifyStatusListeners(remainingPending.length);
    } finally {
      isSyncingActive = false;
    }

    return {
      tasks: localTasks,
      events: localEvents,
      reminders: localReminders,
      notifications: localNotifications,
      preferences: localPreferences,
    };
  },

  /**
   * Alias for syncAll or processQueue.
   */
  async processQueue(): Promise<void> {
    await this.syncAll();
  },
};

// Event listeners for browser online hint
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    SyncManager.syncAll().catch(() => {});
  });
}
