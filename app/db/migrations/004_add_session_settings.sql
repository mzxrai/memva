-- Add settings column to sessions table for storing session-specific settings
ALTER TABLE sessions ADD COLUMN settings TEXT;