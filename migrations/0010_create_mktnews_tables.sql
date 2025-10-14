-- Migration: Create mktnews_messages and mktnews_summaries tables for indefinite storage
-- Date: 2025-10-14

-- Table for storing individual MktNews flash messages
CREATE TABLE IF NOT EXISTS mktnews_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL UNIQUE,  -- Unique message ID from MktNews (data.id)
    mid TEXT NOT NULL,                -- Message ID from data.mid
    type TEXT NOT NULL DEFAULT 'flash',
    action INTEGER NOT NULL,          -- 1 or 2
    category TEXT,                    -- JSON array of categories
    title TEXT,                       -- Flash headline/title
    content TEXT,                     -- Flash content/details
    pic TEXT,                         -- Image URL if present
    important INTEGER NOT NULL DEFAULT 0,  -- 0 or 1
    timestamp INTEGER NOT NULL,       -- Unix timestamp in milliseconds
    time TEXT NOT NULL,               -- ISO timestamp from data.time
    received_at TEXT NOT NULL,        -- ISO timestamp when received by Pi
    raw_data TEXT NOT NULL,           -- Full JSON message for future flexibility
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_mktnews_messages_received_at ON mktnews_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_mktnews_messages_timestamp ON mktnews_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mktnews_messages_important ON mktnews_messages(important, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_mktnews_messages_time ON mktnews_messages(time DESC);

-- Table for storing hourly AI-generated market summaries
CREATE TABLE IF NOT EXISTS mktnews_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    summary_id TEXT NOT NULL UNIQUE,  -- Unique summary ID (e.g., mktnews-summary-1760450440531)
    summary TEXT NOT NULL,            -- Markdown-formatted summary
    generated_at TEXT NOT NULL,       -- ISO timestamp when summary was generated
    message_count INTEGER NOT NULL,   -- Number of messages included in this summary
    timeframe TEXT NOT NULL,          -- Time window (e.g., "60min", "15min")
    version TEXT NOT NULL DEFAULT '1.0',
    context_summaries INTEGER NOT NULL DEFAULT 0,  -- Number of previous summaries used as context
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_mktnews_summaries_generated_at ON mktnews_summaries(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mktnews_summaries_timeframe ON mktnews_summaries(timeframe, generated_at DESC);
