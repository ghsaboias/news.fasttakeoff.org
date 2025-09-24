-- Power Network Relationships Table
-- Stores relationships between entities in the Power Network graph

CREATE TABLE IF NOT EXISTS power_network_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_entity_id TEXT NOT NULL,
  to_entity_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,

  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Foreign key constraints
  FOREIGN KEY (from_entity_id) REFERENCES power_network_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (to_entity_id) REFERENCES power_network_entities(id) ON DELETE CASCADE,

  -- Prevent duplicate relationships
  UNIQUE(from_entity_id, to_entity_id, relationship_type)
);

-- Indexes for efficient graph traversal queries
CREATE INDEX IF NOT EXISTS idx_power_network_relationships_from ON power_network_relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_power_network_relationships_to ON power_network_relationships(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_power_network_relationships_type ON power_network_relationships(relationship_type);

-- Composite index for finding relationships between specific entities
CREATE INDEX IF NOT EXISTS idx_power_network_relationships_entities ON power_network_relationships(from_entity_id, to_entity_id);

-- Index for bidirectional relationship queries
CREATE INDEX IF NOT EXISTS idx_power_network_relationships_bidirectional ON power_network_relationships(to_entity_id, from_entity_id);