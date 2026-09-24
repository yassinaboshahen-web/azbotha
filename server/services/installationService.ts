import { db, queryOne } from '../db/client';
import crypto from 'crypto';

export interface InstallationRecord {
  installation_token: string;
  anonymous_user_id: string;
  created_at: string;
}

export const installationService = {
  /**
   * Generates a new secure installation token for a given planner identity.
   */
  async createInstallation(anonymousUserId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO installations (installation_token, anonymous_user_id, created_at)
            VALUES (?, ?, ?)`,
      args: [token, anonymousUserId, now],
    });

    return token;
  },

  /**
   * Verifies if a given installation token is valid and returns its associated user ID.
   */
  async verifyInstallation(token: string): Promise<string | null> {
    if (!token || typeof token !== 'string') return null;

    const record = await queryOne<Record<string, any>>({
      sql: 'SELECT anonymous_user_id FROM installations WHERE installation_token = ?',
      args: [token],
    });

    return record ? String(record.anonymous_user_id) : null;
  }
};
