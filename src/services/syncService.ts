import { indexedDBRepository } from '../repositories/indexedDBRepository';
import { SyncManager } from './SyncManager';
import { apiClient } from './apiClient';
import { TaskItem, CalendarEvent, QuickThought, UserPreferences, NotificationItem } from '../types';

/**
 * SyncService manages background/online synchronization between local IndexedDB
 * and the Express/Turso cloud backend.
 * All mutations write locally to IndexedDB first, then sync safely with retry logic.
 */
export const syncService = {
  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  },

  /**
   * Process all pending operations in the sync queue via SyncManager.
   */
  async flushSyncQueue(): Promise<void> {
    await SyncManager.processQueue();
  },

  /**
   * Full bidirectional synchronization:
   * 1. Flush local queue first via SyncManager.
   * 2. Pull latest tasks, events, notifications, preferences from backend if connected.
   * 3. Upsert into local IndexedDB.
   */
  async fullSync(): Promise<{
    tasks: TaskItem[];
    events: CalendarEvent[];
    reminders: QuickThought[];
    notifications: NotificationItem[];
    preferences: UserPreferences;
  }> {
    return await SyncManager.syncAll();
  },
};

export { SyncManager };
