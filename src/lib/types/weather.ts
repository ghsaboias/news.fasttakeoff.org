// Weather and wind data types for globe visualization

/**
 * Single wind data point from API or database
 */
export interface WindDataPoint {
  lat: number;            // Latitude (-90 to 90)
  lon: number;            // Longitude (-180 to 180)
  windSpeed: number;      // Wind speed in m/s
  windDirection: number;  // Wind direction in degrees (0-360, 0=North, 90=East, 180=South, 270=West)
  timestamp: string;      // ISO timestamp of forecast
}

/**
 * Grid of wind data points covering a region or globe
 */
export interface WindDataGrid {
  points: WindDataPoint[];
  fetchedAt: string;      // When this data was fetched
  model: string;          // Weather model used (GFS, ECMWF, etc)
  gridResolution: number; // Degrees between grid points
  coverage: 'global' | 'regional';
}

/**
 * Open-Meteo API response format
 * https://open-meteo.com/en/docs
 */
export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  hourly: {
    time: string[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
  };
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
}

/**
 * Batch response when querying multiple coordinates
 */
export type OpenMeteoBatchResponse = OpenMeteoResponse[];

/**
 * Database row from wind_data table
 */
export interface WindDataRow {
  id: number;
  lat: number;
  lon: number;
  wind_speed: number;
  wind_direction: number;
  timestamp: string;
  fetched_at: string;
  model: string;
  altitude: number;
  created_at: string;
}

/**
 * Wind data statistics for monitoring
 */
export interface WindDataStats {
  totalPoints: number;
  latestFetch: string | null;
  oldestFetch: string | null;
  coverageArea: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  } | null;
  averageWindSpeed: number | null;
}
