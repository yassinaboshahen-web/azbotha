import { db, queryOne } from '../db/client';

export interface UserRecord {
  anonymous_user_id: string;
  id: string; // Compatibility alias for anonymous_user_id
  created_at: string;
  updated_at: string;
  last_sync_at: string | null;
}

export const userService = {
  /**
   * Retrieves or provisions an anonymous user installation record in Turso.
   * Ensures every request has a validated cloud user identity.
   */
  async getOrCreateAnonymousUser(anonUserId: string): Promise<UserRecord> {
    const now = new Date().toISOString();

    try {
      await db.batch(
        [
          {
            sql: `INSERT INTO users (anonymous_user_id, created_at, updated_at, last_sync_at)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT(anonymous_user_id) DO UPDATE SET updated_at = excluded.updated_at, last_sync_at = excluded.last_sync_at`,
            args: [anonUserId, now, now, now],
          },
          {
            sql: `INSERT INTO user_preferences (anonymous_user_id, timezone, locale, week_start_day, created_at, updated_at)
                  VALUES (?, 'Africa/Cairo', 'ar', 'saturday', ?, ?)
                  ON CONFLICT(anonymous_user_id) DO NOTHING`,
            args: [anonUserId, now, now],
          },
        ],
        'write'
      );
    } catch (err) {
      console.warn('userService batch upsert warning:', err);
    }

    const existing = await queryOne<Record<string, any>>({
      sql: 'SELECT * FROM users WHERE anonymous_user_id = ?',
      args: [anonUserId],
    });

    const created_at = existing ? String(existing.created_at || now) : now;
    const last_sync_at = existing?.last_sync_at ? String(existing.last_sync_at) : now;

    return {
      anonymous_user_id: anonUserId,
      id: anonUserId,
      created_at,
      updated_at: now,
      last_sync_at,
    };
  },

  async getUserById(anonUserId: string): Promise<UserRecord | null> {
    const record = await queryOne<Record<string, any>>({
      sql: 'SELECT * FROM users WHERE anonymous_user_id = ?',
      args: [anonUserId],
    });
    if (!record) return null;
    const anonId = String(record.anonymous_user_id);
    return {
      anonymous_user_id: anonId,
      id: anonId,
      created_at: String(record.created_at),
      updated_at: String(record.updated_at),
      last_sync_at: record.last_sync_at ? String(record.last_sync_at) : null,
    };
  },

  async updateUser(
    anonUserId: string,
    updates: Record<string, any>
  ): Promise<UserRecord | null> {
    const existing = await this.getUserById(anonUserId);
    if (!existing) return null;

    const now = new Date().toISOString();
    await db.execute({
      sql: 'UPDATE users SET updated_at = ? WHERE anonymous_user_id = ?',
      args: [now, anonUserId],
    });

    return await this.getUserById(anonUserId);
  },
};
