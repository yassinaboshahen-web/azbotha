import { getDB, getInMemoryStore } from './dbEngine';
import { UserPreferencesRecord } from '../types';
import { identityService } from '../services/identity';

export const preferenceRepository = {
  /**
   * Get current user preferences from IndexedDB.
   */
  async getPreferences(): Promise<UserPreferencesRecord> {
    const anonId = identityService.getAnonymousUserId();
    const db = await getDB();

    if (db) {
      try {
        const pref = await db.get('user_preferences', 'default');
        if (pref) return pref;
      } catch (err) {
        console.warn('preferenceRepository.getPreferences DB error:', err);
      }
    } else {
      const memPref = getInMemoryStore('user_preferences').get('default');
      if (memPref) return memPref;
    }

    // Default fallback preferences
    const now = new Date().toISOString();
    const defaultPrefs: UserPreferencesRecord = {
      id: 'default',
      anonymous_user_id: anonId,
      timezone: 'Africa/Cairo',
      locale: 'ar',
      week_starts_on: 'saturday',
      weekStartsOn: 'saturday',
      default_view: 'day',
      defaultView: 'day',
      reminder_preferences: { sound: true, lead_time_minutes: 15 },
      reminderPreferences: { sound: true, leadTimeMinutes: 15 },
      notification_preferences: { in_app: true, push: false },
      notificationPreferences: { inApp: true, push: false },
      created_at: now,
      updated_at: now,
    };

    if (db) {
      try {
        await db.put('user_preferences', defaultPrefs);
      } catch {
        // ignore
      }
    } else {
      getInMemoryStore('user_preferences').set('default', defaultPrefs);
    }

    return defaultPrefs;
  },

  /**
   * Update user preferences in IndexedDB.
   */
  async updatePreferences(updates: Partial<UserPreferencesRecord>): Promise<UserPreferencesRecord> {
    const current = await this.getPreferences();
    const now = new Date().toISOString();

    const updated: UserPreferencesRecord = {
      ...current,
      ...updates,
      week_starts_on: updates.week_starts_on || updates.weekStartsOn || current.week_starts_on,
      weekStartsOn: updates.week_starts_on || updates.weekStartsOn || current.weekStartsOn,
      default_view: updates.default_view || updates.defaultView || current.default_view,
      defaultView: updates.default_view || updates.defaultView || current.defaultView,
      reminder_preferences: updates.reminder_preferences || (updates.reminderPreferences ? {
        sound: updates.reminderPreferences.sound,
        lead_time_minutes: updates.reminderPreferences.leadTimeMinutes,
      } : current.reminder_preferences),
      reminderPreferences: updates.reminderPreferences || (updates.reminder_preferences ? {
        sound: updates.reminder_preferences.sound,
        leadTimeMinutes: updates.reminder_preferences.lead_time_minutes,
      } : current.reminderPreferences),
      updated_at: now,
    };

    const db = await getDB();
    if (db) {
      try {
        await db.put('user_preferences', updated);
      } catch (err) {
        console.warn('preferenceRepository.updatePreferences DB error:', err);
        throw err;
      }
    } else {
      getInMemoryStore('user_preferences').set('default', updated);
    }

    return updated;
  },
};
