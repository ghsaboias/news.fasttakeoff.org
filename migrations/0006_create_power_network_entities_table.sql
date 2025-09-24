-- Power Network Entities Table
-- Stores all entities from the Power Network graph (people, companies, funds)

CREATE TABLE IF NOT EXISTS power_network_entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('person', 'company', 'fund')),
  country TEXT,

  -- Financial data (from graph.json static values)
  ticker TEXT,
  market_cap REAL,    -- in trillions USD for companies
  net_worth REAL,     -- in billions USD for persons
  aum REAL,           -- in trillions USD for funds

  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_power_network_entities_type ON power_network_entities(type);
CREATE INDEX IF NOT EXISTS idx_power_network_entities_ticker ON power_network_entities(ticker);
CREATE INDEX IF NOT EXISTS idx_power_network_entities_country ON power_network_entities(country);

-- Index for financial data queries
CREATE INDEX IF NOT EXISTS idx_power_network_entities_market_cap ON power_network_entities(market_cap) WHERE market_cap IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_power_network_entities_net_worth ON power_network_entities(net_worth) WHERE net_worth IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_power_network_entities_aum ON power_network_entities(aum) WHERE aum IS NOT NULL;