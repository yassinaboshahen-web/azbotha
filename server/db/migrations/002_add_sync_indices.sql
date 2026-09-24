-- Migration: 002_add_sync_indices.sql
-- Description: Indexes for updated_at fields to optimize synchronization pull queries

CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_events_updated_at ON events(updated_at);
CREATE INDEX IF NOT EXISTS idx_reminders_updated_at ON reminders(updated_at);
