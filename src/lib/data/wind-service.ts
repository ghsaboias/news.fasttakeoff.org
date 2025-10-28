import { Cloudflare } from '../../../worker-configuration';
import {
  WindDataPoint,
  OpenMeteoBatchResponse,
  WindDataStats,
  WindDataGrid
} from '@/lib/types/weather';

export class WindService {
  public env: Cloudflare.Env;

  constructor(env: Cloudflare.Env) {
    this.env = env;
    if (!env.FAST_TAKEOFF_NEWS_DB) {
      throw new Error('Missing required D1 database: FAST_TAKEOFF_NEWS_DB');
    }
  }

  /**
   * Generate a grid of sample points covering the globe
   * @param resolution - Degrees between each grid point (default: 15)
   * @returns Array of lat/lon coordinates
   */
  generateGlobalGrid(resolution: number = 15): { lat: number; lon: number }[] {
    const points: { lat: number; lon: number }[] = [];

    for (let lat = -90; lat <= 90; lat += resolution) {
      // Adjust longitude density near poles to avoid over-sampling
      const lonStep = lat > 75 || lat < -75 ? resolution * 2 : resolution;

      for (let lon = -180; lon < 180; lon += lonStep) {
        points.push({ lat, lon });
      }
    }

    console.log(`[WIND] Generated global grid with ${points.length} points (${resolution}° resolution)`);
    return points;
  }

  /**
   * Fetch wind data from Open-Meteo API
   * Handles batching to respect API limits and performance
   */
  async fetchWindDataFromAPI(
    points: { lat: number; lon: number }[]
  ): Promise<WindDataPoint[]> {
    const windData: WindDataPoint[] = [];
    const batchSize = 50; // Open-Meteo allows comma-separated coords, but keep batches reasonable
    const delayBetweenBatches = 100; // ms - be respectful to free API

    console.log(`[WIND] Fetching wind data for ${points.length} points in batches of ${batchSize}`);

    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      const lats = batch.map(p => p.lat).join(',');
      const lons = batch.map(p => p.lon).join(',');

      const url = `https://api.open-meteo.com/v1/forecast?` +
        `latitude=${lats}&longitude=${lons}&` +
        `hourly=wind_speed_10m,wind_direction_10m&` +
        `wind_speed_unit=ms&` +
        `forecast_days=1`;

      try {
        const response = await fetch(url);

        if (!response.ok) {
          console.error(`[WIND] API error for batch ${i / batchSize + 1}: ${response.status}`);
          continue;
        }

        const data: OpenMeteoBatchResponse = await response.json();

        // Extract current hour data (first element in hourly arrays)
        for (let j = 0; j < data.length; j++) {
          const point = data[j];

          if (!point.hourly || !point.hourly.wind_speed_10m || !point.hourly.wind_direction_10m) {
            console.warn(`[WIND] Missing data for point (${point.latitude}, ${point.longitude})`);
            continue;
          }

          windData.push({
            lat: point.latitude,
            lon: point.longitude,
            windSpeed: point.hourly.wind_speed_10m[0],
            windDirection: point.hourly.wind_direction_10m[0],
            timestamp: point.hourly.time[0]
          });
        }

        console.log(`[WIND] Batch ${i / batchSize + 1}/${Math.ceil(points.length / batchSize)}: fetched ${data.length} points`);

        // Respectful delay between batches
        if (i + batchSize < points.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }

      } catch (error) {
        console.error(`[WIND] Failed to fetch batch ${i / batchSize + 1}:`, error);
      }
    }

    console.log(`[WIND] Successfully fetched ${windData.length}/${points.length} wind data points`);
    return windData;
  }

  /**
   * Store wind data in D1 database
   */
  async storeWindData(windData: WindDataPoint[]): Promise<number> {
    let insertedCount = 0;
    let skippedCount = 0;
    const fetchedAt = new Date().toISOString();
    const model = 'GFS'; // Open-Meteo default model
    const altitude = 10; // 10m above ground

    console.log(`[WIND] Storing ${windData.length} wind data points in D1`);

    for (const point of windData) {
      try {
        await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
          INSERT INTO wind_data (
            lat, lon, wind_speed, wind_direction,
            timestamp, fetched_at, model, altitude
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          point.lat,
          point.lon,
          point.windSpeed,
          point.windDirection,
          point.timestamp,
          fetchedAt,
          model,
          altitude
        ).run();

        insertedCount++;
      } catch (error) {
        skippedCount++;
        console.error(`[WIND] Failed to insert point (${point.lat}, ${point.lon}):`, error);
      }
    }

    console.log(`[WIND] Storage complete: ${insertedCount} inserted, ${skippedCount} skipped`);
    return insertedCount;
  }

  /**
   * Get latest wind data from D1
   * Returns the most recent fetch batch
   */
  async getLatestWindData(): Promise<WindDataPoint[]> {
    try {
      const result = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        SELECT lat, lon, wind_speed, wind_direction, timestamp
        FROM wind_data
        WHERE fetched_at = (SELECT MAX(fetched_at) FROM wind_data)
        ORDER BY lat, lon
      `).all();

      if (!result.success) {
        console.error('[WIND] Failed to fetch from D1:', result.error);
        return [];
      }

      const windData = (result.results as Array<{
        lat: number;
        lon: number;
        wind_speed: number;
        wind_direction: number;
        timestamp: string;
      }>).map(row => ({
        lat: row.lat,
        lon: row.lon,
        windSpeed: row.wind_speed,
        windDirection: row.wind_direction,
        timestamp: row.timestamp
      }));

      console.log(`[WIND] Retrieved ${windData.length} latest wind data points`);
      return windData;
    } catch (error) {
      console.error('[WIND] Error fetching wind data:', error);
      return [];
    }
  }

  /**
   * Get wind data as a structured grid
   */
  async getWindDataGrid(): Promise<WindDataGrid | null> {
    try {
      const points = await this.getLatestWindData();

      if (points.length === 0) {
        return null;
      }

      // Get metadata from first point
      const firstPoint = points[0];

      // Calculate grid resolution (assuming uniform spacing)
      const lats = [...new Set(points.map(p => p.lat))].sort((a, b) => a - b);
      const resolution = lats.length > 1 ? Math.abs(lats[1] - lats[0]) : 15;

      // Get fetch time from database
      const metaResult = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        SELECT fetched_at, model FROM wind_data
        WHERE timestamp = ?
        LIMIT 1
      `).bind(firstPoint.timestamp).first();

      return {
        points,
        fetchedAt: metaResult?.fetched_at as string || new Date().toISOString(),
        model: metaResult?.model as string || 'GFS',
        gridResolution: resolution,
        coverage: 'global'
      };
    } catch (error) {
      console.error('[WIND] Error getting wind data grid:', error);
      return null;
    }
  }

  /**
   * Get statistics about stored wind data
   */
  async getStats(): Promise<WindDataStats> {
    try {
      // Get counts and timestamps
      const statsResult = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        SELECT
          COUNT(*) as total,
          MIN(fetched_at) as oldest,
          MAX(fetched_at) as latest,
          AVG(wind_speed) as avg_speed
        FROM wind_data
      `).first();

      // Get coverage area
      const coverageResult = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        SELECT
          MIN(lat) as min_lat,
          MAX(lat) as max_lat,
          MIN(lon) as min_lon,
          MAX(lon) as max_lon
        FROM wind_data
        WHERE fetched_at = (SELECT MAX(fetched_at) FROM wind_data)
      `).first();

      return {
        totalPoints: (statsResult?.total as number) || 0,
        latestFetch: (statsResult?.latest as string) || null,
        oldestFetch: (statsResult?.oldest as string) || null,
        coverageArea: coverageResult ? {
          minLat: coverageResult.min_lat as number,
          maxLat: coverageResult.max_lat as number,
          minLon: coverageResult.min_lon as number,
          maxLon: coverageResult.max_lon as number
        } : null,
        averageWindSpeed: (statsResult?.avg_speed as number) || null
      };
    } catch (error) {
      console.error('[WIND] Error getting stats:', error);
      return {
        totalPoints: 0,
        latestFetch: null,
        oldestFetch: null,
        coverageArea: null,
        averageWindSpeed: null
      };
    }
  }

  /**
   * Daily update task - fetch and store new wind data
   * This is the main entry point called by the cron job
   */
  async updateWindData(): Promise<void> {
    console.log('[WIND] ========== Starting daily wind data update ==========');

    const startTime = Date.now();

    // Step 1: Generate grid
    const grid = this.generateGlobalGrid(5); // 5° resolution ≈ 2,500 points (better hurricane coverage)

    // Step 2: Fetch from Open-Meteo API
    const windData = await this.fetchWindDataFromAPI(grid);

    if (windData.length === 0) {
      console.error('[WIND] No wind data fetched, aborting update');
      return;
    }

    // Step 3: Store in D1
    const insertedCount = await this.storeWindData(windData);

    // Step 4: Cleanup old data (keep last 7 days)
    await this.cleanupOldData(7);

    // Step 5: Get stats
    const stats = await this.getStats();

    const duration = Date.now() - startTime;
    console.log('[WIND] ========== Wind data update complete ==========');
    console.log(`[WIND] Duration: ${duration}ms`);
    console.log(`[WIND] Inserted: ${insertedCount} points`);
    console.log(`[WIND] Total stored: ${stats.totalPoints} points`);
    console.log(`[WIND] Average wind speed: ${stats.averageWindSpeed?.toFixed(2)} m/s`);
  }

  /**
   * Cleanup old wind data to prevent unbounded growth
   */
  async cleanupOldData(daysToKeep: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffIso = cutoffDate.toISOString();

    try {
      const result = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        DELETE FROM wind_data WHERE fetched_at < ?
      `).bind(cutoffIso).run();

      console.log(`[WIND] Cleaned up data older than ${daysToKeep} days (cutoff: ${cutoffIso})`);
      console.log(`[WIND] Rows deleted: ${result.meta.changes || 0}`);
    } catch (error) {
      console.error('[WIND] Error during cleanup:', error);
    }
  }
}
