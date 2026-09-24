import { taskRepository } from './taskRepository';
import { eventRepository } from './eventRepository';
import { reminderRepository } from './reminderRepository';
import { preferenceRepository } from './preferenceRepository';
import { notificationRepository } from './notificationRepository';
import { metadataRepository } from './metadataRepository';
import { syncQueueRepository } from './syncQueueRepository';
import { identityService } from '../services/identity';
import { apiClient } from '../services/apiClient';
import { AnonymousUser } from '../types';

export const indexedDBRepository = {
  /**
   * Initializes IndexedDB repositories and default preferences on first launch with ZERO mock data.
   */
  async initialize(): Promise<AnonymousUser> {
    const anonUser = identityService.getOrCreateAnonymousUser();

    try {
      // Ensure default user preferences exist
      await preferenceRepository.getPreferences();
    } catch {
      // ignore
    }

    return anonUser;
  },

  // --- Tasks ---
  async getAllTasks() {
    return await taskRepository.getTasks();
  },
  async saveTask(task: any) {
    if (task.id) {
      const existing = await taskRepository.getTask(task.id);
      if (existing) {
        return await taskRepository.updateTask(task.id, task);
      }
    }
    return await taskRepository.createTask(task);
  },
  async deleteTask(id: string) {
    return await taskRepository.deleteTask(id);
  },

  // --- Events ---
  async getAllEvents() {
    return await eventRepository.getEvents();
  },
  async saveEvent(event: any) {
    if (event.id) {
      const existing = await eventRepository.getEvent(event.id);
      if (existing) {
        return await eventRepository.updateEvent(event.id, event);
      }
    }
    return await eventRepository.createEvent(event);
  },
  async deleteEvent(id: string) {
    return await eventRepository.deleteEvent(id);
  },

  // --- Reminders ---
  async getAllReminders() {
    return await reminderRepository.getReminders();
  },
  async saveReminder(reminder: any) {
    if (reminder.id) {
      const existing = await reminderRepository.getReminder(reminder.id);
      if (existing) {
        return await reminderRepository.updateReminder(reminder.id, reminder);
      }
    }
    return await reminderRepository.createReminder(reminder);
  },
  async deleteReminder(id: string) {
    return await reminderRepository.deleteReminder(id);
  },

  // --- Notifications ---
  async getAllNotifications() {
    return await notificationRepository.getNotifications();
  },
  async saveNotification(notif: any) {
    const db = await import('./dbEngine').then((m) => m.getDB());
    if (db) {
      try {
        await db.put('notifications', notif);
      } catch {
        // ignore
      }
    }
  },
  async markNotificationRead(id: string) {
    return await notificationRepository.markNotificationRead(id);
  },
  async markAllNotificationsRead() {
    return await notificationRepository.markAllNotificationsRead();
  },

  // --- Preferences ---
  async getPreferences() {
    return await preferenceRepository.getPreferences();
  },
  async savePreferences(updates: any) {
    return await preferenceRepository.updatePreferences(updates);
  },

  // --- Sync Queue ---
  async enqueueSyncOp(op: any) {
    if (!apiClient.isCloudSyncEnabled()) {
      return null;
    }
    return await syncQueueRepository.enqueueSyncOp({
      entity_type: op.entityType || op.entity_type,
      action: op.action,
      entity_id: op.entityId || op.entity_id,
      payload: op.payload,
    });
  },
  async getPendingSyncOps() {
    return await syncQueueRepository.getPendingSyncOps();
  },
  async markSyncOpSynced(id: string) {
    return await syncQueueRepository.markSyncOpSynced(id);
  },
  async markSyncOpFailed(id: string, error: string) {
    return await syncQueueRepository.markSyncOpFailed(id, error);
  },

  // --- Metadata ---
  async getMetadata<T>(key: string) {
    return await metadataRepository.getMetadata<T>(key);
  },
  async setMetadata(key: string, value: any) {
    return await metadataRepository.setMetadata(key, value);
  },
};

export {
  taskRepository,
  eventRepository,
  reminderRepository,
  preferenceRepository,
  notificationRepository,
  metadataRepository,
  syncQueueRepository,
};
