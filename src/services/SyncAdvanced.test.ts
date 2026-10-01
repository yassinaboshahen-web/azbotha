import { describe, it, expect } from 'vitest';
import { SyncManager } from './SyncManager';

describe('Sync Engine Advanced Scenarios & Edge Cases', () => {
  it('provides current status info accurately', () => {
    const status = SyncManager.getCurrentStatus();
    expect(status).toHaveProperty('state');
    expect(status).toHaveProperty('label');
    expect(status).toHaveProperty('pendingCount');
  });

  it('supports status subscriptions without throwing', () => {
    const unsubscribe = SyncManager.subscribeStatus((info) => {
      expect(info).toHaveProperty('state');
    });
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});
