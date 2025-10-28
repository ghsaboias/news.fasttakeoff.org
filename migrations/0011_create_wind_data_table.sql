-- Migration: Create wind_data table for global wind speed/direction visualization
-- Date: 2025-10-28
-- Description: Stores wind data from Open-Meteo API for globe particle visualization

CREATE TABLE IF NOT EXISTS wind_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL NOT NULL,                      -- Latitude (-90 to 90)
    lon REAL NOT NULL,                      -- Longitude (-180 to 180)
    wind_speed REAL NOT NULL,               -- Wind speed in m/s
    wind_direction REAL NOT NULL,           -- Wind direction in degrees (0-360)
    timestamp TEXT NOT NULL,                -- ISO timestamp of forecast data
    fetched_at TEXT NOT NULL,               -- When we fetched this data from API
    model TEXT NOT NULL DEFAULT 'GFS',      -- Weather model used (GFS, ECMWF, etc)
    altitude INTEGER NOT NULL DEFAULT 10,   -- Altitude in meters (10m default)
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_wind_data_coords ON wind_data(lat, lon, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_wind_data_timestamp ON wind_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wind_data_fetched_at ON wind_data(fetched_at DESC);

-- Index for cleanup queries (delete old data)
CREATE INDEX IF NOT EXISTS idx_wind_data_cleanup ON wind_data(fetched_at);
