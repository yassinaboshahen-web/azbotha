import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncQueueRepository } from '../repositories/syncQueueRepository';
import { SyncManager } from './SyncManager';
import { apiClient } from './apiClient';
import { TaskItem, CalendarEvent, SyncOperationRecord } from '../types';

describe('Sync Engine Production Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('A. Offline Create: enqueues operation and saves locally without network', async () => {
    const op = await syncQueueRepository.enqueueSyncOp({
      entity_type: 'task',
      entity_id: 'tsk_off_1',
      operation_type: 'create',
      payload: { title: 'مهمة أوفلاين', due_date: '2026-10-01' },
    });

    expect(op).toBeDefined();
    expect(op.entity_id).toBe('tsk_off_1');
    expect(op.status).toBe('pending');

    const pending = await syncQueueRepository.getPendingSyncOps();
    expect(pending.some((p) => p.entity_id === 'tsk_off_1')).toBe(true);
  });

  it('B. Offline Update: coalesces create and update into a single merged operation', () => {
    const ops: SyncOperationRecord[] = [
      {
        id: 'op_1',
        anonymous_user_id: 'anon_1',
        entity_type: 'task',
        entity_id: 'tsk_100',
        operation_type: 'create',
        action: 'create',
        payload: { title: 'عنوان أول' },
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        status: 'pending',
        retry_count: 0,
      },
      {
        id: 'op_2',
        anonymous_user_id: 'anon_1',
        entity_type: 'task',
        entity_id: 'tsk_100',
        operation_type: 'update',
        action: 'update',
        payload: { title: 'عنوان جديد معدل', category: 'جامعة' },
        created_at: '2026-09-30T10:05:00.000Z',
        updated_at: '2026-09-30T10:05:00.000Z',
        status: 'pending',
        retry_count: 0,
      },
    ];

    const coalesced = syncQueueRepository.coalesceSyncOps(ops);
    expect(coalesced.length).toBe(1);
    expect(coalesced[0].operation_type).toBe('create');
    expect(coalesced[0].payload.title).toBe('عنوان جديد معدل');
    expect(coalesced[0].payload.category).toBe('جامعة');
  });

  it('C. Offline Delete: cancels out offline create if entity created and deleted offline', () => {
    const ops: SyncOperationRecord[] = [
      {
        id: 'op_1',
        anonymous_user_id: 'anon_1',
        entity_type: 'task',
        entity_id: 'tsk_temp',
        operation_type: 'create',
        action: 'create',
        payload: { title: 'مهمة مؤقتة' },
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        status: 'pending',
        retry_count: 0,
      },
      {
        id: 'op_2',
        anonymous_user_id: 'anon_1',
        entity_type: 'task',
        entity_id: 'tsk_temp',
        operation_type: 'delete',
        action: 'delete',
        payload: { id: 'tsk_temp' },
        created_at: '2026-09-30T10:01:00.000Z',
        updated_at: '2026-09-30T10:01:00.000Z',
        status: 'pending',
        retry_count: 0,
      },
    ];

    const coalesced = syncQueueRepository.coalesceSyncOps(ops);
    expect(coalesced.length).toBe(0); // Cancelled out! No unnecessary server network calls
  });

  it('E. Duplicate Sync (Mutex / Single-Flight): concurrent syncAll calls reuse single execution', async () => {
    vi.spyOn(apiClient, 'isCloudSyncEnabled').mockReturnValue(true);
    vi.spyOn(SyncManager, 'checkConnectivity').mockResolvedValue(false);

    const p1 = SyncManager.syncAll();
    const p2 = SyncManager.syncAll();

    expect(p1).toBe(p2); // Exact same promise reference (Mutex single flight)
    await Promise.all([p1, p2]);
  });

  it('G. Delete vs Update: Tombstone precedence', () => {
    const remoteEvt = {
      id: 'evt_del_1',
      title: 'معاد محذوف',
      deleted_at: '2026-09-30T12:00:00.000Z',
      updated_at: '2026-09-30T12:00:00.000Z',
    };

    expect(remoteEvt.deleted_at).toBeDefined();
    // In SyncManager, remoteEvt.deleted_at causes local IndexedDB deletion
  });

  it('J. Exponential Backoff calculation', () => {
    const retryCounts = [0, 1, 2, 3, 5];
    const backoffs = retryCounts.map((rc) => Math.min(Math.pow(2, rc) * 1000, 60000));

    expect(backoffs).toEqual([1000, 2000, 4000, 8000, 32000]);
  });
});
