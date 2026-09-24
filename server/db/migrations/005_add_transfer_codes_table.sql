-- Migration 004: Create transfer_codes table
CREATE TABLE IF NOT EXISTS transfer_codes (
    code_hash TEXT PRIMARY KEY,
    anonymous_user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);
