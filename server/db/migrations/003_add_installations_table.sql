-- Migration: 003_add_installations_table.sql
-- Description: Table to map cryptographically secure installation credentials to anonymous planner identities

CREATE TABLE IF NOT EXISTS installations (
  installation_token TEXT PRIMARY KEY NOT NULL,
  anonymous_user_id TEXT NOT NULL REFERENCES users(anonymous_user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_installations_anon_user ON installations(anonymous_user_id);
