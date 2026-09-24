import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  TaskRecord,
  EventRecord,
  ReminderRecord,
  NotificationRecord,
  UserPreferencesRecord,
  PlannerMetadataRecord,
  SyncOperationRecord,
  AnonymousUser,
} from '../types';

export interface DayCompanionDBSchema extends DBSchema {
  anonymous_user: {
    key: string;
    value: AnonymousUser;
  };
  tasks: {
    key: string;
    value: TaskRecord;
    indexes: {
      'by-anon-id': string;
      'by-due-date': string;
      'by-completed': number;
    };
  };
  events: {
    key: string;
    value: EventRecord;
    indexes: {
      'by-anon-id': string;
      'by-date': string;
    };
  };
  reminders: {
    key: string;
    value: ReminderRecord;
    indexes: {
      'by-anon-id': string;
      'by-status': string;
    };
  };
  notifications: {
    key: string;
    value: NotificationRecord;
    indexes: {
      'by-anon-id': string;
      'by-read': number;
    };
  };
  user_preferences: {
    key: string;
    value: UserPreferencesRecord;
    indexes: {
      'by-anon-id': string;
    };
  };
  planner_metadata: {
    key: string;
    value: PlannerMetadataRecord;
  };
  sync_operations: {
    key: string;
    value: SyncOperationRecord;
    indexes: {
      'by-anon-id': string;
      'by-status': string;
      'by-timestamp': string;
    };
  };
}

const DB_NAME = 'DayCompanionDB';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<DayCompanionDBSchema> | null = null;
let isInMemoryFallback = false;

// In-Memory Fallback Storage if IndexedDB is completely disabled/blocked
const inMemoryStores: Record<string, Map<string, any>> = {
  anonymous_user: new Map(),
  tasks: new Map(),
  events: new Map(),
  reminders: new Map(),
  notifications: new Map(),
  user_preferences: new Map(),
  planner_metadata: new Map(),
  sync_operations: new Map(),
};

/**
 * Initializes and returns the versioned IndexedDB database connection.
 * Handles database initialization failures gracefully with in-memory fallback.
 */
export async function getDB(): Promise<IDBPDatabase<DayCompanionDBSchema> | null> {
  if (isInMemoryFallback) return null;
  if (dbInstance) return dbInstance;

  try {
    if (typeof indexedDB === 'undefined') {
      isInMemoryFallback = true;
      return null;
    }

    dbInstance = await openDB<DayCompanionDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Migration Handler for Version 1
        if (oldVersion < 1) {
          // Store 1: Anonymous User
          if (!db.objectStoreNames.contains('anonymous_user')) {
            db.createObjectStore('anonymous_user', { keyPath: 'id' });
          }

          // Store 2: Tasks
          if (!db.objectStoreNames.contains('tasks')) {
            const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
            taskStore.createIndex('by-anon-id', 'anonymous_user_id');
            taskStore.createIndex('by-due-date', 'due_date');
            taskStore.createIndex('by-completed', 'completed');
          }

          // Store 3: Events
          if (!db.objectStoreNames.contains('events')) {
            const eventStore = db.createObjectStore('events', { keyPath: 'id' });
            eventStore.createIndex('by-anon-id', 'anonymous_user_id');
            eventStore.createIndex('by-date', 'date');
          }

          // Store 4: Reminders
          if (!db.objectStoreNames.contains('reminders')) {
            const reminderStore = db.createObjectStore('reminders', { keyPath: 'id' });
            reminderStore.createIndex('by-anon-id', 'anonymous_user_id');
            reminderStore.createIndex('by-status', 'status');
          }

          // Store 5: Notifications
          if (!db.objectStoreNames.contains('notifications')) {
            const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
            notifStore.createIndex('by-anon-id', 'anonymous_user_id');
            notifStore.createIndex('by-read', 'read');
          }

          // Store 6: User Preferences
          if (!db.objectStoreNames.contains('user_preferences')) {
            const prefStore = db.createObjectStore('user_preferences', { keyPath: 'id' });
            prefStore.createIndex('by-anon-id', 'anonymous_user_id');
          }

          // Store 7: Planner Metadata
          if (!db.objectStoreNames.contains('planner_metadata')) {
            db.createObjectStore('planner_metadata', { keyPath: 'key' });
          }

          // Store 8: Sync Operations
          if (!db.objectStoreNames.contains('sync_operations')) {
            const syncStore = db.createObjectStore('sync_operations', { keyPath: 'id' });
            syncStore.createIndex('by-anon-id', 'anonymous_user_id');
            syncStore.createIndex('by-status', 'status');
            syncStore.createIndex('by-timestamp', 'timestamp');
          }
        }
      },
      blocked() {
        console.warn('IndexedDB database upgrade blocked by another open connection.');
      },
      blocking() {
        if (dbInstance) {
          dbInstance.close();
          dbInstance = null;
        }
      },
      terminated() {
        dbInstance = null;
      },
    });

    return dbInstance;
  } catch (err) {
    console.warn('IndexedDB unavailable or failed to initialize, switching to safe fallback:', err);
    isInMemoryFallback = true;
    return null;
  }
}

export function isInMemory(): boolean {
  return isInMemoryFallback;
}

export function getInMemoryStore(storeName: string): Map<string, any> {
  if (!inMemoryStores[storeName]) {
    inMemoryStores[storeName] = new Map();
  }
  return inMemoryStores[storeName];
}
