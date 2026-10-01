-- Migration: 007_add_idempotency_key.sql
-- Description: Add idempotency tracking support to sync_operations

ALTER TABLE sync_operations ADD COLUMN client_op_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_ops_client_op_id ON sync_operations(anonymous_user_id, client_op_id);
