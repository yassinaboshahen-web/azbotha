import { getDB, getInMemoryStore } from './dbEngine';
import { SyncOperationRecord, SyncOperationKind, SyncEntityType } from '../types';
import { identityService } from '../services/identity';

export const syncQueueRepository = {
  /**
   * Enqueue a sync operation in IndexedDB immediately.
   */
  async enqueueSyncOp(
    op: Partial<SyncOperationRecord> & {
      entity_type: SyncEntityType;
      entity_id: string;
      operation_type?: SyncOperationKind;
      action?: SyncOperationKind;
      payload: Record<string, unknown>;
    }
  ): Promise<SyncOperationRecord> {
    const anonId = op.anonymous_user_id || identityService.getAnonymousUserId();
    const id = op.id || `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const kind: SyncOperationKind = op.operation_type || op.action || 'create';

    const syncOp: SyncOperationRecord = {
      id,
      anonymous_user_id: anonId,
      entity_type: op.entity_type,
      entity_id: op.entity_id,
      operation_type: kind,
      action: kind,
      payload: op.payload || {},
      created_at: op.created_at || now,
      updated_at: now,
      timestamp: now,
      retry_count: op.retry_count || 0,
      status: 'pending',
    };

    const db = await getDB();
    if (db) {
      try {
        await db.put('sync_operations', syncOp);
      } catch (err) {
        console.warn('syncQueueRepository.enqueueSyncOp DB error:', err);
      }
    } else {
      getInMemoryStore('sync_operations').set(syncOp.id, syncOp);
    }

    return syncOp;
  },

  /**
   * Get all pending or processing or failed sync operations.
   */
  async getPendingSyncOps(): Promise<SyncOperationRecord[]> {
    const db = await getDB();
    let all: SyncOperationRecord[] = [];

    if (db) {
      try {
        all = await db.getAll('sync_operations');
      } catch (err) {
        console.warn('syncQueueRepository.getPendingSyncOps DB error:', err);
        all = Array.from(getInMemoryStore('sync_operations').values());
      }
    } else {
      all = Array.from(getInMemoryStore('sync_operations').values());
    }

    return all.filter((op) => op.status === 'pending' || op.status === 'failed' || op.status === 'processing');
  },

  /**
   * Update a sync operation state (e.g. processing lock).
   */
  async updateSyncOpStatus(id: string, status: SyncOperationRecord['status']): Promise<void> {
    const now = new Date().toISOString();
    const db = await getDB();

    if (db) {
      try {
        const op = await db.get('sync_operations', id);
        if (op) {
          op.status = status;
          op.updated_at = now;
          op.last_attempt_at = now;
          await db.put('sync_operations', op);
        }
      } catch {
        // ignore
      }
    } else {
      const op = getInMemoryStore('sync_operations').get(id);
      if (op) {
        op.status = status;
        op.updated_at = now;
        op.last_attempt_at = now;
      }
    }
  },

  /**
   * Remove a successfully synchronized operation.
   */
  async markSyncOpSynced(id: string): Promise<void> {
    const db = await getDB();
    if (db) {
      try {
        await db.delete('sync_operations', id);
      } catch (err) {
        console.warn('syncQueueRepository.markSyncOpSynced DB error:', err);
      }
    }
    getInMemoryStore('sync_operations').delete(id);
  },

  /**
   * Mark a sync operation as failed and increment retry count with timestamp.
   */
  async markSyncOpFailed(id: string, error: string): Promise<void> {
    const now = new Date().toISOString();
    const db = await getDB();

    if (db) {
      try {
        const op = await db.get('sync_operations', id);
        if (op) {
          op.status = 'failed';
          op.retry_count += 1;
          op.last_attempt_at = now;
          op.updated_at = now;
          op.error = error;
          await db.put('sync_operations', op);
        }
      } catch (err) {
        console.warn('syncQueueRepository.markSyncOpFailed DB error:', err);
      }
    } else {
      const op = getInMemoryStore('sync_operations').get(id);
      if (op) {
        op.status = 'failed';
        op.retry_count += 1;
        op.last_attempt_at = now;
        op.updated_at = now;
        op.error = error;
      }
    }
  },
};
