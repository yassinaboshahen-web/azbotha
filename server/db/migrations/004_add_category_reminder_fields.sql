-- 004_add_category_reminder_fields.sql
ALTER TABLE events ADD COLUMN category TEXT;
ALTER TABLE events ADD COLUMN category_label TEXT;
ALTER TABLE events ADD COLUMN reminder INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN category TEXT;
ALTER TABLE tasks ADD COLUMN reminder INTEGER DEFAULT 0;
