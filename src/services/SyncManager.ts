import { syncQueueRepository } from '../repositories/syncQueueRepository';
import { indexedDBRepository, metadataRepository } from '../repositories/indexedDBRepository';
import { apiClient } from './apiClient';
import { ReminderEngine } from './ReminderEngine';
import { identityService } from './identity';
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

export type SyncStatusState = 'synced' | 'syncing' | 'offline_saved' | 'offline_retry' | 'unauthorized' | 'error';

export interface SyncStatusInfo {
  state: SyncStatusState;
  label: string;
  pendingCount: number;
  lastSyncedAt?: string;
  lastError?: string;
}

const STATUS_LABELS: Record<SyncStatusState, string> = {
  synced: 'بياناتك محفوظة',
  syncing: 'بنزامن بياناتك...',
  offline_saved: 'اتحفظ عندك، وهنتزامن أول ما الاتصال يرجع.',
  offline_retry: 'في مشكلة في المزامنة، بس بياناتك المحلية محفوظة.',
  unauthorized: 'الجلسة غير صحيحة، تم الحفظ محلياً.',
  error: 'تعذر الاتصال بالسيرفر، بياناتك محفوظة محلياً.',
};

const MAX_RETRY_LIMIT = 10;
const LAST_PULLED_METADATA_KEY = 'sync_last_pulled_at';

let activeSyncPromise: Promise<{
  tasks: TaskItem[];
  events: CalendarEvent[];
  reminders: QuickThought[];
  notifications: NotificationItem[];
  preferences: UserPreferences;
}> | null = null;

let currentSyncState: SyncStatusState = 'synced';
let lastSyncedTime: string | undefined = undefined;
let lastSyncError: string | undefined = undefined;
const statusListeners = new Set<(info: SyncStatusInfo) => void>();

function notifyStatusListeners(pendingCount: number = 0) {
  const info: SyncStatusInfo = {
    state: currentSyncState,
    label: STATUS_LABELS[currentSyncState] || STATUS_LABELS.synced,
    pendingCount,
    lastSyncedAt: lastSyncedTime,
    lastError: lastSyncError,
  };
  statusListeners.forEach((listener) => {
    try {
      listener(info);
    } catch {
      // ignore listener errors
    }
  });
}

export const SyncManager = {
  /**
   * Subscribe to subtle sync status changes.
   */
  subscribeStatus(listener: (info: SyncStatusInfo) => void): () => void {
    statusListeners.add(listener);
    syncQueueRepository.getPendingSyncOps().then((pending) => {
      listener({
        state: currentSyncState,
        label: STATUS_LABELS[currentSyncState] || STATUS_LABELS.synced,
        pendingCount: pending.length,
        lastSyncedAt: lastSyncedTime,
        lastError: lastSyncError,
      });
    });
    return () => {
      statusListeners.delete(listener);
    };
  },

  getCurrentStatus(pendingCount: number = 0): SyncStatusInfo {
    return {
      state: currentSyncState,
      label: STATUS_LABELS[currentSyncState] || STATUS_LABELS.synced,
      pendingCount,
      lastSyncedAt: lastSyncedTime,
      lastError: lastSyncError,
    };
  },

  /**
   * Fast health & network connectivity check.
   */
  async checkConnectivity(): Promise<boolean> {
    if (!apiClient.isCloudSyncEnabled()) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

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
      this.syncAll().catch(() => {});
    }

    return syncOp;
  },

  /**
   * Full bidirectional synchronization with Single-Flight Mutex Execution.
   */
  syncAll(): Promise<{
    tasks: TaskItem[];
    events: CalendarEvent[];
    reminders: QuickThought[];
    notifications: NotificationItem[];
    preferences: UserPreferences;
  }> {
    if (activeSyncPromise) {
      return activeSyncPromise;
    }

    activeSyncPromise = (async () => {
      try {
        return await this._executeSyncPipeline();
      } finally {
        activeSyncPromise = null;
      }
    })();

    return activeSyncPromise;
  },

  /**
   * Internal sync execution pipeline
   */
  async _executeSyncPipeline(): Promise<{
    tasks: TaskItem[];
    events: CalendarEvent[];
    reminders: QuickThought[];
    notifications: NotificationItem[];
    preferences: UserPreferences;
  }> {
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

    currentSyncState = 'syncing';
    notifyStatusListeners(pendingOps.length);

    try {
      // Ensure installation credential exists
      await identityService.ensureInstallationCredential();

      // STEP A: Push local pending operations with coalescing & backoff
      if (pendingOps.length > 0) {
        const coalescedOps = syncQueueRepository.coalesceSyncOps(pendingOps);

        for (const op of coalescedOps) {
          // Check max retry limit
          if (op.retry_count >= MAX_RETRY_LIMIT) {
            console.warn(`[SyncManager] Max retry limit reached for op ${op.id}. Skipping.`);
            continue;
          }

          // Exponential backoff check
          if (op.status === 'failed' && op.last_attempt_at) {
            const lastAttempt = new Date(op.last_attempt_at).getTime();
            const backoffMs = Math.min(Math.pow(2, op.retry_count) * 1000, 60000);
            if (Date.now() - lastAttempt < backoffMs) {
              continue;
            }
          }

          await syncQueueRepository.updateSyncOpStatus(op.id, 'processing');

          try {
            const pushRes = await apiClient.pushSyncOperations([op]);
            if (pushRes && pushRes.success) {
              await syncQueueRepository.markSyncOpSynced(op.id);
            }
          } catch (err: any) {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg.includes('401') || errMsg.includes('الجلسة انتهت')) {
              currentSyncState = 'unauthorized';
              lastSyncError = errMsg;
              notifyStatusListeners(pendingOps.length);
              break;
            }
            await syncQueueRepository.markSyncOpFailed(op.id, errMsg);
          }
        }
      }

      // STEP B: Incremental Pull with cursor timestamp and pagination loop
      let lastPulledAt = await metadataRepository.getMetadata<string>(LAST_PULLED_METADATA_KEY) || undefined;
      const pendingAfterPush = await syncQueueRepository.getPendingSyncOps();
      const pendingEntityIds = new Set(pendingAfterPush.map((p) => p.entity_id));

      let hasMore = true;
      let pageCount = 0;
      let newPullTimestamp = new Date().toISOString();

      while (hasMore && pageCount < 50) {
        pageCount++;
        const cloudResponse = await apiClient.pullCloudChanges(lastPulledAt, 200);
        const changes = cloudResponse?.changes || {};
        newPullTimestamp = cloudResponse?.timestamp || newPullTimestamp;
        hasMore = Boolean(cloudResponse?.hasMore);

        let maxUpdatedInBatch = lastPulledAt;

        // Helper to track max updated time
        const trackMax = (updated?: string) => {
          if (!updated) return;
          if (!maxUpdatedInBatch || new Date(updated).getTime() > new Date(maxUpdatedInBatch).getTime()) {
            maxUpdatedInBatch = updated;
          }
        };

        // 1. Process Tasks
        if (Array.isArray(changes.tasks)) {
          for (const remoteTask of changes.tasks) {
            const tId = String(remoteTask.id);
            trackMax(remoteTask.updated_at || remoteTask.created_at);
            if (pendingEntityIds.has(tId)) continue;

            if (remoteTask.deleted_at) {
              await indexedDBRepository.deleteTask(tId);
              continue;
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

        // 2. Process Events
        if (Array.isArray(changes.events)) {
          for (const remoteEvt of changes.events) {
            const eId = String(remoteEvt.id);
            trackMax(remoteEvt.updated_at || remoteEvt.created_at);
            if (pendingEntityIds.has(eId)) continue;

            if (remoteEvt.deleted_at) {
              await indexedDBRepository.deleteEvent(eId);
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

        // 3. Process Reminders
        if (Array.isArray(changes.reminders)) {
          for (const remoteRem of changes.reminders) {
            const rId = String(remoteRem.id);
            trackMax(remoteRem.updated_at || remoteRem.created_at);
            if (pendingEntityIds.has(rId)) continue;

            if (remoteRem.deleted_at) {
              await indexedDBRepository.deleteReminder(rId);
              continue;
            }

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
            trackMax(remoteNotif.updated_at || remoteNotif.created_at);
            if (pendingEntityIds.has(nId)) continue;

            if (remoteNotif.deleted_at) {
              await indexedDBRepository.deleteNotification(nId);
              continue;
            }

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

        lastPulledAt = maxUpdatedInBatch || newPullTimestamp;
        if (!hasMore) break;
      }

      // Save last pulled timestamp cursor
      await metadataRepository.setMetadata(LAST_PULLED_METADATA_KEY, newPullTimestamp);

      ReminderEngine.checkAndFireReminders().catch(() => {});

      lastSyncedTime = new Date().toISOString();
      lastSyncError = undefined;
      const remainingPending = await syncQueueRepository.getPendingSyncOps();
      currentSyncState = remainingPending.length > 0 ? 'offline_retry' : 'synced';
      notifyStatusListeners(remainingPending.length);
    } catch (err: any) {
      lastSyncError = err instanceof Error ? err.message : String(err);
      const remainingPending = await syncQueueRepository.getPendingSyncOps();
      currentSyncState = 'offline_retry';
      notifyStatusListeners(remainingPending.length);
    }

    return {
      tasks: localTasks,
      events: localEvents,
      reminders: localReminders,
      notifications: localNotifications,
      preferences: localPreferences,
    };
  },

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
