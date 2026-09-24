import { getDB, getInMemoryStore } from './dbEngine';
import { NotificationRecord } from '../types';

export const notificationRepository = {
  /**
   * Get all notifications ordered by updated_at / id descending.
   */
  async getNotifications(): Promise<NotificationRecord[]> {
    const db = await getDB();
    let all: NotificationRecord[] = [];

    if (db) {
      try {
        all = await db.getAll('notifications');
      } catch (err) {
        console.warn('notificationRepository.getNotifications DB error:', err);
        all = Array.from(getInMemoryStore('notifications').values());
      }
    } else {
      all = Array.from(getInMemoryStore('notifications').values());
    }

    return all.sort((a, b) => (b.created_at || b.id).localeCompare(a.created_at || a.id));
  },

  /**
   * Mark a notification as read.
   */
  async markNotificationRead(id: string): Promise<void> {
    const db = await getDB();
    const now = new Date().toISOString();

    if (db) {
      try {
        const existing = await db.get('notifications', id);
        if (existing) {
          existing.read = true;
          existing.updated_at = now;
          await db.put('notifications', existing);
        }
      } catch (err) {
        console.warn('notificationRepository.markNotificationRead DB error:', err);
      }
    } else {
      const existing = getInMemoryStore('notifications').get(id);
      if (existing) {
        existing.read = true;
        existing.updated_at = now;
      }
    }
  },

  /**
   * Mark all notifications as read.
   */
  async markAllNotificationsRead(): Promise<void> {
    const notifications = await this.getNotifications();
    const db = await getDB();
    const now = new Date().toISOString();

    if (db) {
      try {
        const tx = db.transaction('notifications', 'readwrite');
        for (const notif of notifications) {
          if (!notif.read) {
            notif.read = true;
            notif.updated_at = now;
            await tx.store.put(notif);
          }
        }
        await tx.done;
      } catch (err) {
        console.warn('notificationRepository.markAllNotificationsRead DB error:', err);
      }
    } else {
      for (const notif of notifications) {
        notif.read = true;
        notif.updated_at = now;
      }
    }
  },
};
