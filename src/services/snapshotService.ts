import { indexedDBRepository } from '../repositories/indexedDBRepository';

export interface DataSnapshot {
  timestamp: string;
  tasks: any[];
  events: any[];
  reminders: any[];
  preferences: any;
}

export const snapshotService = {
  /**
   * Captures a complete snapshot of current planner data and stores it in planner_metadata.
   * Maintains only the latest 7 snapshots.
   */
  async captureSnapshot(prefix: string = 'snapshot_'): Promise<string> {
    try {
      const [tasks, events, reminders, preferences] = await Promise.all([
        indexedDBRepository.getAllTasks(),
        indexedDBRepository.getAllEvents(),
        indexedDBRepository.getAllReminders(),
        indexedDBRepository.getPreferences(),
      ]);

      if (tasks.length === 0 && events.length === 0 && reminders.length === 0) {
          return ''; // Don't capture empty snapshots
      }

      const snapshot: DataSnapshot = {
        timestamp: new Date().toISOString(),
        tasks,
        events,
        reminders,
        preferences,
      };

      let key = '';
      if (prefix === 'snapshot_') {
          const todayStr = new Date().toISOString().split('T')[0];
          key = `snapshot_${todayStr}`;
      } else {
          key = `${prefix}${Date.now()}`;
      }

      await indexedDBRepository.setMetadata(key, snapshot);

      // Maintain latest 7 snapshots in metadata list
      await this.pruneOldSnapshots();

      return key;
    } catch (err) {
      console.warn('Failed to capture snapshot:', err);
      return '';
    }
  },

  /**
   * Captures snapshot only once per day on application launch.
   */
  async captureDailyLaunchSnapshot(): Promise<void> {
    const lastCheck = await indexedDBRepository.getMetadata<string>('last_daily_snapshot_date');
    const todayStr = new Date().toISOString().split('T')[0];

    if (lastCheck !== todayStr) {
      const key = await this.captureSnapshot();
      if (key) {
        await indexedDBRepository.setMetadata('last_daily_snapshot_date', todayStr);
      }
    }
  },

  /**
   * Lists all existing snapshots sorted by timestamp descending.
   */
  async listSnapshots(): Promise<{ key: string; timestamp: string; count: number; label?: string }[]> {
    const db = await import('../repositories/dbEngine').then(m => m.getDB());
    if (!db) return [];

    try {
      const allKeys = await db.getAllKeys('planner_metadata');
      const snapshotKeys = (allKeys as string[]).filter(k => typeof k === 'string' && k.startsWith('snapshot_'));

      const snapshots = [];
      for (const k of snapshotKeys) {
        const snap = await indexedDBRepository.getMetadata<DataSnapshot>(k);
        if (snap && snap.timestamp) {
          const totalCount = (snap.tasks?.length || 0) + (snap.events?.length || 0) + (snap.reminders?.length || 0);
          snapshots.push({
            key: k,
            timestamp: snap.timestamp,
            count: totalCount,
            label: k.startsWith('snapshot_prerestore_') ? 'قبل الاسترجاع' : undefined
          });
        }
      }

      // Sort newest first
      return snapshots.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (err) {
      console.warn('Failed to list snapshots:', err);
      return [];
    }
  },

  /**
   * Restores data from a previously captured snapshot.
   */
  async restoreFromSnapshot(key: string): Promise<boolean> {
    const snap = await indexedDBRepository.getMetadata<DataSnapshot>(key);
    if (!snap) return false;

    // 1. Capture a rollback snapshot of current data before overwriting
    await this.captureSnapshot('snapshot_prerestore_');

    // 2. Overwrite local tables (Merge Behavior)
    if (Array.isArray(snap.tasks)) {
      for (const t of snap.tasks) {
        await indexedDBRepository.saveTask(t);
        await indexedDBRepository.enqueueSyncOp({
          entityType: 'task',
          action: 'create',
          entityId: t.id,
          payload: t,
        });
      }
    }

    if (Array.isArray(snap.events)) {
      for (const ev of snap.events) {
        await indexedDBRepository.saveEvent(ev);
        await indexedDBRepository.enqueueSyncOp({
          entityType: 'event',
          action: 'create',
          entityId: ev.id,
          payload: ev,
        });
      }
    }

    if (Array.isArray(snap.reminders)) {
      for (const th of snap.reminders) {
        await indexedDBRepository.saveReminder(th);
        await indexedDBRepository.enqueueSyncOp({
          entityType: 'reminder',
          action: 'create',
          entityId: th.id,
          payload: {
            id: th.id,
            title: th.title || th.text || '',
            text: th.text || th.title || '',
            scheduled_for: th.scheduled_for,
            date: th.date,
            status: th.status || 'pending',
            type: th.type || 'custom',
            pinned: Boolean(th.pinned),
            trigger_configuration: th,
          },
        });
      }
    }

    if (snap.preferences) {
      await indexedDBRepository.savePreferences(snap.preferences);
    }

    // Trigger sync
    const { syncService } = await import('./syncService');
    syncService.flushSyncQueue().catch(() => {});

    return true;
  },

  /**
   * Deletes oldest snapshots keeping only the 7 newest ones.
   */
  async pruneOldSnapshots(): Promise<void> {
    const db = await import('../repositories/dbEngine').then(m => m.getDB());
    if (!db) return;

    try {
      const allSnapshots = await this.listSnapshots();
      
      const dailySnapshots = allSnapshots.filter(s => s.key.startsWith('snapshot_') && !s.key.startsWith('snapshot_prerestore_'));
      const preRestoreSnapshots = allSnapshots.filter(s => s.key.startsWith('snapshot_prerestore_'));

      if (dailySnapshots.length > 7) {
        const toDelete = dailySnapshots.slice(7);
        for (const snap of toDelete) {
          await db.delete('planner_metadata', snap.key);
        }
      }

      if (preRestoreSnapshots.length > 3) {
        const toDelete = preRestoreSnapshots.slice(3);
        for (const snap of toDelete) {
            await db.delete('planner_metadata', snap.key);
        }
      }
    } catch (err) {
      console.warn('Failed to prune old snapshots:', err);
    }
  }
};
