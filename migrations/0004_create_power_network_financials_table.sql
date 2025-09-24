-- Power Network Financial Data Table
-- Stores daily financial data for companies in the Power Network

CREATE TABLE IF NOT EXISTS power_network_financials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Company identification
  symbol TEXT NOT NULL,
  company_name TEXT,
  entity_id TEXT,  -- Links to Power Network graph.json entity key

  -- Financial data (from Yahoo Finance Chart API)
  price REAL,
  currency TEXT DEFAULT 'USD',
  market_cap REAL,
  volume INTEGER,
  avg_volume INTEGER,

  -- Price ranges
  day_high REAL,
  day_low REAL,
  previous_close REAL,
  fifty_two_week_high REAL,
  fifty_two_week_low REAL,

  -- Exchange info
  exchange TEXT,

  -- Metadata
  data_source TEXT DEFAULT 'yahoo_chart_api',
  scraped_at TEXT NOT NULL,  -- ISO timestamp when data was fetched
  date_key TEXT NOT NULL,    -- YYYY-MM-DD for daily grouping

  -- Performance tracking
  extraction_success BOOLEAN DEFAULT TRUE,
  field_count INTEGER,       -- Number of fields successfully extracted

  UNIQUE(symbol, date_key)   -- One record per symbol per day
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_power_network_symbol_date ON power_network_financials(symbol, date_key);
CREATE INDEX IF NOT EXISTS idx_power_network_date ON power_network_financials(date_key);
CREATE INDEX IF NOT EXISTS idx_power_network_entity ON power_network_financials(entity_id);

-- View for latest data per company
CREATE VIEW IF NOT EXISTS power_network_latest AS
SELECT DISTINCT
  pnf.*
FROM power_network_financials pnf
INNER JOIN (
  SELECT symbol, MAX(date_key) as latest_date
  FROM power_network_financials
  WHERE extraction_success = TRUE
  GROUP BY symbol
) latest ON pnf.symbol = latest.symbol AND pnf.date_key = latest.latest_date
WHERE pnf.extraction_success = TRUE
ORDER BY pnf.symbol;

-- View for daily performance analysis
CREATE VIEW IF NOT EXISTS power_network_daily_performance AS
SELECT
  date_key,
  COUNT(*) as companies_updated,
  AVG(field_count) as avg_fields_extracted,
  COUNT(CASE WHEN extraction_success THEN 1 END) as successful_extractions,
  COUNT(CASE WHEN NOT extraction_success THEN 1 END) as failed_extractions,
  ROUND(AVG(price), 2) as avg_stock_price,
  SUM(market_cap) as total_market_cap
FROM power_network_financials
GROUP BY date_key
ORDER BY date_key DESC;