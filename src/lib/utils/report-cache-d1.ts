import { CACHE, TIME, TimeframeKey } from '@/lib/config';
import { Report } from '@/lib/types/core';
import { groupAndSortReports } from '@/lib/utils';
import type { Cloudflare } from '../../../worker-configuration';

// Type for D1 row results
interface ReportRow {
    id: number;
    report_id: string;
    channel_id: string | null;
    channel_name: string | null;
    headline: string;
    city: string;
    body: string;
    generated_at: string;
    message_count: number | null;
    last_message_timestamp: string | null;
    user_generated: number; // SQLite stores booleans as integers
    timeframe: string | null;
    cache_status: string | null;
    message_ids: string | null;
    created_at: number;
    expires_at: number;
}

export class ReportCacheD1 {
    /**
     * Store reports array in normalized D1 table
     * Breaks apart the Report[] into individual rows
     */
    static async store(channelId: string, timeframe: TimeframeKey, reports: Report[], env: Cloudflare.Env): Promise<void> {
        if (!env.FAST_TAKEOFF_NEWS_DB) {
            throw new Error('Missing required D1 database: FAST_TAKEOFF_NEWS_DB');
        }

        const cleanedReports = this.cleanupOldReports(reports);
        const now = Date.now();
        const expiresAt = now + (CACHE.TTL.REPORTS * 1000);

        // Delete existing reports for this channel/timeframe combination
        await env.FAST_TAKEOFF_NEWS_DB.prepare(
            'DELETE FROM reports WHERE channel_id = ? AND timeframe = ?'
        ).bind(channelId, timeframe).run();

        // Insert each report as a separate row
        for (const report of cleanedReports) {
            await env.FAST_TAKEOFF_NEWS_DB.prepare(`
                INSERT INTO reports (
                    report_id, channel_id, channel_name, headline, city, body,
                    generated_at, message_count, last_message_timestamp, user_generated,
                    timeframe, cache_status, message_ids, created_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                report.reportId,
                report.channelId || channelId,
                report.channelName,
                report.headline,
                report.city,
                report.body,
                report.generatedAt,
                report.messageCount || 0,
                report.lastMessageTimestamp,
                report.userGenerated || false,
                report.timeframe || timeframe,
                report.cacheStatus,
                JSON.stringify(report.messageIds || []),
                now,
                expiresAt
            ).run();
        }
    }

    /**
     * Get reports array for specific channel/timeframe
     * Reconstructs Report[] from normalized rows
     */
    static async get(channelId: string, timeframe: TimeframeKey, env: Cloudflare.Env): Promise<Report[] | null> {
        if (!env.FAST_TAKEOFF_NEWS_DB) return null;

        const result = await env.FAST_TAKEOFF_NEWS_DB.prepare(
            'SELECT * FROM reports WHERE channel_id = ? AND timeframe = ? AND expires_at > ? ORDER BY generated_at DESC'
        ).bind(channelId, timeframe, Date.now()).all();

        if (!result.success || !result.results.length) {
            return null;
        }

        return result.results.map((row) => this.rowToReport(row as unknown as ReportRow));
    }

    /**
     * Get recent reports from the last 24 hours for a channel/timeframe
     */
    static async getPreviousReports(channelId: string, timeframe: TimeframeKey, env: Cloudflare.Env): Promise<Report[]> {
        if (!env.FAST_TAKEOFF_NEWS_DB) return [];

        const twentyFourHoursAgo = Date.now() - TIME.TWENTY_FOUR_HOURS_MS;

        const result = await env.FAST_TAKEOFF_NEWS_DB.prepare(`
            SELECT * FROM reports 
            WHERE channel_id = ? AND timeframe = ? 
            AND generated_at > ? AND expires_at > ?
            ORDER BY generated_at DESC 
            LIMIT 1
        `).bind(channelId, timeframe, new Date(twentyFourHoursAgo).toISOString(), Date.now()).all();

        if (!result.success || !result.results.length) {
            return [];
        }

        return result.results.map((row) => this.rowToReport(row as unknown as ReportRow));
    }

    /**
     * Batch get multiple channel/timeframe combinations
     */
    static async batchGet(keys: string[], env: Cloudflare.Env): Promise<Map<string, Report[] | null>> {
        if (!env.FAST_TAKEOFF_NEWS_DB) return new Map();

        const results = new Map<string, Report[] | null>();

        // Parse keys like "reports:channelId:timeframe"
        for (const key of keys) {
            const parts = key.split(':');
            if (parts.length === 3 && parts[0] === 'reports') {
                const channelId = parts[1];
                const timeframe = parts[2] as TimeframeKey;
                const reports = await this.get(channelId, timeframe, env);
                results.set(key, reports);
            } else {
                results.set(key, null);
            }
        }

        return results;
    }

    /**
     * Get all reports with optional limit
     * This is the most complex method as it needs to handle homepage caching and sorting
     */
    static async getAllReports(env: Cloudflare.Env, limit?: number): Promise<Report[]> {
        if (!env.FAST_TAKEOFF_NEWS_DB) {
            console.log('FAST_TAKEOFF_NEWS_DB not available');
            return [];
        }

        // For homepage requests (small limits), try to use cached homepage reports first
        if (limit && limit <= 20) {
            try {
                const homepageReports = await this.getHomepageReports(env);
                if (homepageReports && homepageReports.length > 0) {
                    return homepageReports.slice(0, limit);
                }
                console.log('[REPORTS] No cached homepage reports found, falling back to DB query');
            } catch (error) {
                console.warn('[REPORTS] Homepage cache failed, falling back:', error);
            }
        }

        try {
            // Get all non-expired reports
            const query = limit && limit <= 50 
                ? 'SELECT * FROM reports WHERE expires_at > ? ORDER BY generated_at DESC LIMIT ?'
                : 'SELECT * FROM reports WHERE expires_at > ? ORDER BY generated_at DESC';
            
            const bindings = limit && limit <= 50 ? [Date.now(), limit * 2] : [Date.now()];
            
            const result = await env.FAST_TAKEOFF_NEWS_DB.prepare(query).bind(...bindings).all();

            if (!result.success) {
                console.error('[REPORTS] Database query failed:', result.error);
                return [];
            }

            const reports = result.results.map((row) => this.rowToReport(row as unknown as ReportRow));
            
            // Use the original groupAndSortReports logic to prioritize today's reports by message count
            const sortedReports = groupAndSortReports(reports);
            
            // Apply limit after proper sorting if specified
            return limit ? sortedReports.slice(0, limit) : sortedReports;
        } catch (error) {
            console.error('[REPORTS] Database query failed:', error);
            return [];
        }
    }

    /**
     * Get all reports for a specific channel
     */
    static async getAllReportsForChannel(channelId: string, env: Cloudflare.Env, timeframe?: TimeframeKey): Promise<Report[]> {
        if (!env.FAST_TAKEOFF_NEWS_DB) {
            console.log('FAST_TAKEOFF_NEWS_DB not available');
            return [];
        }

        let query = 'SELECT * FROM reports WHERE channel_id = ? AND expires_at > ? ORDER BY generated_at DESC';
        let bindings: (string | number)[] = [channelId, Date.now()];

        if (timeframe) {
            query = 'SELECT * FROM reports WHERE channel_id = ? AND timeframe = ? AND expires_at > ? ORDER BY generated_at DESC';
            bindings = [channelId, timeframe, Date.now()];
        }

        const result = await env.FAST_TAKEOFF_NEWS_DB.prepare(query).bind(...bindings).all();

        if (!result.success || !result.results.length) {
            return [];
        }

        return result.results.map((row) => this.rowToReport(row as unknown as ReportRow));
    }

    /**
     * Store homepage reports cache - these are stored as a special report with a known report_id
     */
    static async storeHomepageReports(reports: Report[], env: Cloudflare.Env): Promise<void> {
        if (!env.FAST_TAKEOFF_NEWS_DB) return;

        try {
            const topReports = reports.slice(0, 10); // Store top 10 reports
            const now = Date.now();
            const expiresAt = now + (CACHE.TTL.REPORTS * 1000);

            // Delete existing homepage cache entries
            await env.FAST_TAKEOFF_NEWS_DB.prepare(
                'DELETE FROM reports WHERE report_id IN (?, ?)'
            ).bind('homepage:latest-reports', 'homepage:backup-reports').run();

            // Store primary homepage cache
            await env.FAST_TAKEOFF_NEWS_DB.prepare(`
                INSERT INTO reports (
                    report_id, channel_id, channel_name, headline, city, body,
                    generated_at, message_count, last_message_timestamp, user_generated,
                    timeframe, cache_status, message_ids, created_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                'homepage:latest-reports',
                'homepage',
                'Homepage Cache',
                'Homepage Latest Reports',
                'Cache',
                JSON.stringify(topReports), // Store the array in the body field
                new Date().toISOString(),
                topReports.length,
                null,
                false,
                'homepage',
                'homepage-cache',
                '[]',
                now,
                expiresAt
            ).run();

            // Store backup cache with shorter TTL
            const backupExpiresAt = now + 3600000; // 1 hour
            await env.FAST_TAKEOFF_NEWS_DB.prepare(`
                INSERT INTO reports (
                    report_id, channel_id, channel_name, headline, city, body,
                    generated_at, message_count, last_message_timestamp, user_generated,
                    timeframe, cache_status, message_ids, created_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                'homepage:backup-reports',
                'homepage',
                'Homepage Cache',
                'Homepage Backup Reports',
                'Cache',
                JSON.stringify(topReports),
                new Date().toISOString(),
                topReports.length,
                null,
                false,
                'homepage',
                'homepage-cache-backup',
                '[]',
                now,
                backupExpiresAt
            ).run();

            console.log(`[REPORTS] Cached ${topReports.length} reports for homepage (primary + backup)`);
        } catch (error) {
            console.error('[REPORTS] Failed to cache homepage reports:', error);
        }
    }

    /**
     * Get cached homepage reports
     */
    static async getHomepageReports(env: Cloudflare.Env): Promise<Report[] | null> {
        if (!env.FAST_TAKEOFF_NEWS_DB) return null;

        try {
            // Try primary cache first
            let result = await env.FAST_TAKEOFF_NEWS_DB.prepare(
                'SELECT body FROM reports WHERE report_id = ? AND expires_at > ?'
            ).bind('homepage:latest-reports', Date.now()).first();

            if (result?.body) {
                const reports = JSON.parse(result.body as string);
                if (Array.isArray(reports) && reports.length > 0) {
                    return reports;
                }
            }

            // Fallback to backup cache
            console.log('[REPORTS] Primary homepage cache empty, trying backup');
            result = await env.FAST_TAKEOFF_NEWS_DB.prepare(
                'SELECT body FROM reports WHERE report_id = ? AND expires_at > ?'
            ).bind('homepage:backup-reports', Date.now()).first();

            if (result?.body) {
                const backupReports = JSON.parse(result.body as string);
                if (Array.isArray(backupReports) && backupReports.length > 0) {
                    return backupReports;
                }
            }

            return null;
        } catch (error) {
            console.warn('[REPORTS] Failed to get homepage reports:', error);
            return null;
        }
    }

    // Private helper methods
    private static cleanupOldReports(reports: Report[]): Report[] {
        if (!reports || reports.length === 0) return [];

        const retentionThreshold = Date.now() - CACHE.RETENTION.REPORTS * 1000;
        const originalCount = reports.length;

        const filteredReports = reports.filter(report => {
            const generatedTime = new Date(report.generatedAt || '').getTime();
            return generatedTime > retentionThreshold;
        });

        const removedCount = originalCount - filteredReports.length;
        if (removedCount > 0) {
            console.log(`[REPORTS] Cleaned up ${removedCount} reports older than ${CACHE.RETENTION.REPORTS / TIME.DAY_SEC} days`);
        }

        return filteredReports;
    }

    /**
     * Convert database row to Report object
     */
    private static rowToReport(row: ReportRow): Report {
        return {
            reportId: row.report_id,
            channelId: row.channel_id || undefined,
            channelName: row.channel_name || undefined,
            headline: row.headline,
            city: row.city,
            body: row.body,
            generatedAt: row.generated_at,
            messageCount: row.message_count ?? undefined,
            lastMessageTimestamp: row.last_message_timestamp ?? undefined,
            userGenerated: Boolean(row.user_generated),
            timeframe: row.timeframe ?? undefined,
            cacheStatus: row.cache_status as 'hit' | 'miss',
            messageIds: row.message_ids ? JSON.parse(row.message_ids) : undefined
        };
    }

    /**
     * Cleanup expired reports (can be called periodically)
     */
    static async cleanup(env: Cloudflare.Env): Promise<number> {
        if (!env.FAST_TAKEOFF_NEWS_DB) return 0;

        try {
            const result = await env.FAST_TAKEOFF_NEWS_DB.prepare(
                'DELETE FROM reports WHERE expires_at < ?'
            ).bind(Date.now()).run();

            if (result.success && result.meta.changes > 0) {
                console.log(`[REPORTS] Cleaned up ${result.meta.changes} expired reports`);
                return result.meta.changes;
            }
            return 0;
        } catch (error) {
            console.error('[REPORTS] Failed to cleanup expired reports:', error);
            return 0;
        }
    }
}