-- Migration: 001_initial_schema.sql
-- Description: Turso/libSQL production relational schema for anonymous planner installations

-- 1. Users table (Anonymous installation identities)
CREATE TABLE IF NOT EXISTS users (
  anonymous_user_id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_sync_at TEXT
);

-- 2. Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  anonymous_user_id TEXT NOT NULL REFERENCES users(anonymous_user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  due_time TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_anon_user ON tasks(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- 3. Events table
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  anonymous_user_id TEXT NOT NULL REFERENCES users(anonymous_user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  location TEXT,
  doctor_or_ta TEXT,
  course TEXT,
  notes TEXT,
  status TEXT DEFAULT 'upcoming',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_anon_user ON events(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- 4. Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY NOT NULL,
  anonymous_user_id TEXT NOT NULL REFERENCES users(anonymous_user_id) ON DELETE CASCADE,
  entity_id TEXT,
  entity_type TEXT,
  reminder_type TEXT DEFAULT 'custom',
  trigger_configuration TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reminders_anon_user ON reminders(anonymous_user_id);

-- 5. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  anonymous_user_id TEXT NOT NULL REFERENCES users(anonymous_user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_anon_user ON notifications(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- 6. User Preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  anonymous_user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(anonymous_user_id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'Africa/Cairo',
  locale TEXT NOT NULL DEFAULT 'ar',
  week_start_day TEXT NOT NULL DEFAULT 'saturday',
  notification_preferences TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Sync Operations table
CREATE TABLE IF NOT EXISTS sync_operations (
  id TEXT PRIMARY KEY NOT NULL,
  anonymous_user_id TEXT NOT NULL REFERENCES users(anonymous_user_id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  last_attempt_at TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_ops_anon_user ON sync_operations(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_sync_ops_status ON sync_operations(status);
