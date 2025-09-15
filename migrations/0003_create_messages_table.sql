-- Migration: Create messages table for hybrid D1+KV architecture
-- Purpose: Store essential Discord message properties (26 total, 68% storage reduction)
-- Created: Phase 2 of Discord Messages KV→D1 Migration

CREATE TABLE IF NOT EXISTS messages (
  -- Primary key
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Core Message Properties (7)
  message_id TEXT NOT NULL UNIQUE,
  channel_id TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  author_username TEXT,
  author_discriminator TEXT,
  author_global_name TEXT,
  
  -- Context (1)
  referenced_message_content TEXT,
  
  -- Structured JSON Properties (3)
  embeds TEXT, -- JSON string: title, description, fields[], author.*, thumbnail.*, image.* (NEW)
  attachments TEXT, -- JSON string: url, filename, content_type, width, height
  reaction_summary TEXT, -- JSON string: [{"emoji": "👀", "count": 11}] for engagement tracking
  
  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel_timestamp ON messages(channel_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at);

-- Comments for documentation
-- Total properties: 26 (vs 84+ in original Discord messages)
-- Storage reduction: 68% (58 properties eliminated)
-- Key features: Newsletter image support (embeds.image.*), engagement tracking (reaction_summary)
-- Architecture: D1 authoritative storage + KV cache for recent messages (6-12h)