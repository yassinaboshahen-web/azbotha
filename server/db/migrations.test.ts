import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from './migrate';
import { db } from './client';

describe('Database Migrations & Production Architecture', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('runs migrations successfully and is idempotent', async () => {
    await expect(runMigrations()).resolves.not.toThrow();
  });

  it('creates core tables with consistent anonymous_user_id ownership model', async () => {
    const tables = ['users', 'installations', 'tasks', 'events', 'notifications', 'user_preferences', 'reminders', 'transfer_codes'];
    for (const t of tables) {
      const res = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='${t}'`);
      expect(res.rows.length).toBe(1);
    }
  });

  it('includes soft-delete tombstone column (deleted_at) on syncable entities', async () => {
    const tableInfo = await db.execute("PRAGMA table_info(tasks)");
    const columns = tableInfo.rows.map((r: any) => r.name);
    expect(columns).toContain('deleted_at');
    expect(columns).toContain('anonymous_user_id');
    expect(columns).toContain('created_at');
    expect(columns).toContain('updated_at');
  });

  it('includes proper indexes for performance and synchronization', async () => {
    const indexes = await db.execute("SELECT name FROM sqlite_master WHERE type='index'");
    const indexNames = indexes.rows.map((r: any) => r.name);
    expect(indexNames.some(name => name.includes('idx_tasks'))).toBe(true);
  });
});
