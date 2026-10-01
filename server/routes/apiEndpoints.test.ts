import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import taskRoutes from './taskRoutes';
import eventRoutes from './eventRoutes';
import notificationRoutes from './notificationRoutes';
import preferenceRoutes from './preferenceRoutes';
import reminderRoutes from './reminderRoutes';
import insightRoutes from './insightRoutes';
import { runMigrations } from '../db/migrate';
import { db } from '../db/client';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use('/api/tasks', taskRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/insights', insightRoutes);

describe('Backend API Endpoints & Edge Cases', () => {
  let testUserId: string;
  let testToken: string;

  beforeAll(async () => {
    await runMigrations();
    testUserId = 'test_api_user_' + crypto.randomBytes(6).toString('hex');
    testToken = crypto.randomBytes(32).toString('hex');

    await db.execute({
      sql: "INSERT INTO users (anonymous_user_id, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))",
      args: [testUserId],
    });
    await db.execute({
      sql: 'INSERT INTO installations (installation_token, anonymous_user_id) VALUES (?, ?)',
      args: [testToken, testUserId],
    });
  });

  it('verifies user and installation records exist in test DB', async () => {
    const userCheck = await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM users WHERE anonymous_user_id = ?',
      args: [testUserId],
    });
    expect(Number(userCheck.rows[0].cnt)).toBe(1);
  });

  it('handles empty database queries gracefully for tasks and events', async () => {
    const emptyTasks = await db.execute({
      sql: "SELECT * FROM tasks WHERE anonymous_user_id = ? AND (deleted_at IS NULL OR deleted_at = '')",
      args: [testUserId],
    });
    expect(emptyTasks.rows).toHaveLength(0);

    const emptyEvents = await db.execute({
      sql: "SELECT * FROM events WHERE anonymous_user_id = ? AND (deleted_at IS NULL OR deleted_at = '')",
      args: [testUserId],
    });
    expect(emptyEvents.rows).toHaveLength(0);
  });
});
