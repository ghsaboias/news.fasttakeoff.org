-- Create power_network_financials table for testing
-- This table stores live financial data for Power Network companies
CREATE TABLE IF NOT EXISTS power_network_financials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL UNIQUE,
  entity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_name TEXT,
  day_high REAL,
  day_low REAL,
  volume INTEGER,
  previous_close REAL,
  fifty_two_week_high REAL,
  fifty_two_week_low REAL,
  market_cap REAL,
  shares_outstanding INTEGER,
  day_change REAL,
  day_change_percent REAL,
  scraped_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast lookups by symbol
CREATE INDEX IF NOT EXISTS idx_power_network_symbol ON power_network_financials(symbol);

-- Create index for entity lookups
CREATE INDEX IF NOT EXISTS idx_power_network_entity ON power_network_financials(entity_id);

-- Create index for recent data queries
CREATE INDEX IF NOT EXISTS idx_power_network_scraped_at ON power_network_financials(scraped_at DESC);