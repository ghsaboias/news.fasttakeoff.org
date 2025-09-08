-- Create reports table with normalized schema
CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL UNIQUE,
    channel_id TEXT,
    channel_name TEXT,
    headline TEXT NOT NULL,
    city TEXT NOT NULL,
    body TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    message_count INTEGER,
    last_message_timestamp TEXT,
    user_generated BOOLEAN DEFAULT FALSE,
    timeframe TEXT,
    cache_status TEXT,
    message_ids TEXT, -- JSON array of message IDs
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

-- Strategic indexes for common query patterns
CREATE INDEX idx_report_id ON reports(report_id);
CREATE INDEX idx_channel_id ON reports(channel_id);
CREATE INDEX idx_generated_at ON reports(generated_at);
CREATE INDEX idx_timeframe ON reports(timeframe);