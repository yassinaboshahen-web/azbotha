import { getDB, getInMemoryStore } from './dbEngine';
import { ReminderRecord } from '../types';
import { identityService } from '../services/identity';

export const reminderRepository = {
  /**
   * Create a new reminder / quick thought record.
   */
  async createReminder(
    data: Omit<ReminderRecord, 'id' | 'anonymous_user_id' | 'created_at' | 'updated_at'> & {
      id?: string;
      anonymous_user_id?: string;
    }
  ): Promise<ReminderRecord> {
    const anonId = data.anonymous_user_id || identityService.getAnonymousUserId();
    const id = data.id || `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const reminder: ReminderRecord = {
      id,
      anonymous_user_id: anonId,
      title: data.title || data.text || '',
      text: data.text || data.title || '',
      scheduled_for: data.scheduled_for, // Leave undefined if not specified
      date: data.date || now.split('T')[0],
      status: data.status || 'pending',
      type: data.type || 'custom',
      pinned: Boolean(data.pinned),
      created_at: now,
      updated_at: now,
    };

    const db = await getDB();
    if (db) {
      try {
        await db.put('reminders', reminder);
      } catch (err) {
        console.warn('reminderRepository.createReminder DB put error:', err);
        throw err;
      }
    } else {
      getInMemoryStore('reminders').set(reminder.id, reminder);
    }

    return reminder;
  },

  /**
   * Get a single reminder by ID.
   */
  async getReminder(id: string): Promise<ReminderRecord | null> {
    const db = await getDB();
    if (db) {
      try {
        return (await db.get('reminders', id)) || null;
      } catch {
        return getInMemoryStore('reminders').get(id) || null;
      }
    }
    return getInMemoryStore('reminders').get(id) || null;
  },

  /**
   * Get all reminders with optional status filter.
   */
  async getReminders(filter?: { status?: string }): Promise<ReminderRecord[]> {
    const db = await getDB();
    let all: ReminderRecord[] = [];

    if (db) {
      try {
        all = await db.getAll('reminders');
      } catch (err) {
        console.warn('reminderRepository.getReminders DB error:', err);
        all = Array.from(getInMemoryStore('reminders').values());
      }
    } else {
      all = Array.from(getInMemoryStore('reminders').values());
    }

    if (filter && filter.status) {
      all = all.filter((r) => r.status === filter.status);
    }

    return all;
  },

  /**
   * Update an existing reminder record.
   */
  async updateReminder(id: string, updates: Partial<ReminderRecord>): Promise<ReminderRecord | null> {
    const db = await getDB();
    let existing: ReminderRecord | null = null;

    if (db) {
      try {
        existing = (await db.get('reminders', id)) || null;
      } catch {
        existing = getInMemoryStore('reminders').get(id) || null;
      }
    } else {
      existing = getInMemoryStore('reminders').get(id) || null;
    }

    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: ReminderRecord = {
      ...existing,
      ...updates,
      title: updates.title || updates.text || existing.title,
      text: updates.text || updates.title || existing.text,
      updated_at: now,
    };

    if (db) {
      try {
        await db.put('reminders', updated);
      } catch (err) {
        console.warn('reminderRepository.updateReminder DB error:', err);
        throw err;
      }
    } else {
      getInMemoryStore('reminders').set(id, updated);
    }

    return updated;
  },

  /**
   * Delete a reminder record.
   */
  async deleteReminder(id: string): Promise<boolean> {
    const db = await getDB();
    if (db) {
      try {
        await db.delete('reminders', id);
      } catch (err) {
        console.warn('reminderRepository.deleteReminder DB error:', err);
      }
    }
    getInMemoryStore('reminders').delete(id);
    return true;
  },
};
