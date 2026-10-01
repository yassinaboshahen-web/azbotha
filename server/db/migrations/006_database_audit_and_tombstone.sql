-- Migration: 006_database_audit_and_tombstone.sql
-- Description: Production database architecture upgrade, soft-delete tombstones, notification timestamps, transfer_codes foreign key & indexes

-- 1. Add deleted_at tombstone columns to syncable entities
ALTER TABLE tasks ADD COLUMN deleted_at TEXT;
ALTER TABLE events ADD COLUMN deleted_at TEXT;
ALTER TABLE reminders ADD COLUMN deleted_at TEXT;

-- 2. Ensure notifications has updated_at and deleted_at
ALTER TABLE notifications ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE notifications ADD COLUMN deleted_at TEXT;

-- 3. Soft-delete tombstone indexes
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON events(deleted_at);
CREATE INDEX IF NOT EXISTS idx_reminders_deleted_at ON reminders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON notifications(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notifications_updated_at ON notifications(updated_at);

-- 4. Compound indexes for user sync queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_updated ON tasks(anonymous_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_events_user_updated ON events(anonymous_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_reminders_user_updated ON reminders(anonymous_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_updated ON notifications(anonymous_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_sync_ops_user_status ON sync_operations(anonymous_user_id, status);

-- 5. Upgrade transfer_codes table with foreign key constraint and default timestamps
CREATE TABLE IF NOT EXISTS transfer_codes_new (
    code_hash TEXT PRIMARY KEY NOT NULL,
    anonymous_user_id TEXT NOT NULL REFERENCES users(anonymous_user_id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

INSERT OR IGNORE INTO transfer_codes_new (code_hash, anonymous_user_id, created_at, expires_at)
SELECT code_hash, anonymous_user_id, COALESCE(created_at, datetime('now')), expires_at FROM transfer_codes;

DROP TABLE IF EXISTS transfer_codes;
ALTER TABLE transfer_codes_new RENAME TO transfer_codes;

-- 6. Indexes for transfer_codes table
CREATE INDEX IF NOT EXISTS idx_transfer_codes_anon_user ON transfer_codes(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_codes_expires ON transfer_codes(expires_at);
