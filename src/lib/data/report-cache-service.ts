import { CACHE, TIME, TimeframeKey } from '@/lib/config';
import { Report } from '@/lib/types/core';
import { groupAndSortReports } from '@/lib/utils';
import { Cloudflare } from '../../../worker-configuration';
import { CacheManager } from '../cache-utils';

export class ReportCacheService {
    private cacheManager: CacheManager;

    constructor(env: Cloudflare.Env) {
        if (!env.REPORTS_CACHE) {
            throw new Error('Missing required KV namespace: REPORTS_CACHE');
        }
        this.cacheManager = new CacheManager(env);
    }

    /**
     * Filters out reports older than the retention period
     */
    private cleanupOldReports(reports: Report[]): Report[] {
        if (!reports || reports.length === 0) return [];

        const retentionThreshold = Date.now() - CACHE.RETENTION.REPORTS * 1000;
        const originalCount = reports.length;

        const filteredReports = reports.filter(report => {
            const generatedTime = new Date(report.generatedAt || '').getTime();
            return generatedTime > retentionThreshold;
        });

        const removedCount = originalCount - filteredReports.length;
        if (removedCount > 0) {
            console.log(`[REPORTS] Cleaned up ${removedCount} reports older than ${CACHE.RETENTION.REPORTS / (24 * 60 * 60)} days`);
        }

        return filteredReports;
    }

    async cacheReport(channelId: string, timeframe: TimeframeKey, reports: Report[]): Promise<void> {
        const key = `reports:${channelId}:${timeframe}`;
        const cleanedReports = this.cleanupOldReports(reports);
        await this.cacheManager.put('REPORTS_CACHE', key, cleanedReports, CACHE.TTL.REPORTS);
    }

    async getRecentPreviousReports(channelId: string, timeframe: TimeframeKey): Promise<Report[]> {
        const allCachedReports = await this.getReportsFromCache(channelId, timeframe) || [];

        if (allCachedReports.length === 0) {
            return [];
        }

        const twentyFourHoursAgo = Date.now() - TIME.TWENTY_FOUR_HOURS_MS;

        const recentReports = allCachedReports
            .filter(report => {
                const generatedTime = new Date(report.generatedAt || '').getTime();
                return generatedTime > twentyFourHoursAgo;
            })
            .sort((a, b) => new Date(b.generatedAt || '').getTime() - new Date(a.generatedAt || '').getTime());

        // Only return the most recent report
        return recentReports.slice(0, 1);
    }

    async getReportsFromCache(channelId: string, timeframe: TimeframeKey): Promise<Report[] | null> {
        const key = `reports:${channelId}:${timeframe}`;
        return this.cacheManager.get<Report[]>('REPORTS_CACHE', key);
    }

    async batchGetReports(keys: string[]): Promise<Map<string, Report[] | null>> {
        return this.cacheManager.batchGet<Report[]>('REPORTS_CACHE', keys);
    }

    async getAllReportsFromCache(limit?: number): Promise<Report[]> {
        const reportsCache = this.cacheManager.getKVNamespace('REPORTS_CACHE');
        if (!reportsCache) {
            console.log('REPORTS_CACHE namespace not available');
            return [];
        }

        // For homepage requests (small limits), try to use cached homepage reports first
        if (limit && limit <= 20) {
            const homepageReports = await this.getHomepageReports();
            if (homepageReports && homepageReports.length > 0) {
                console.log(`[REPORTS] Using cached homepage reports (${homepageReports.length} available)`);
                return homepageReports.slice(0, limit);
            }
            console.log('[REPORTS] No cached homepage reports found, falling back to full fetch');
        }

        // Fallback to original logic for larger requests or when homepage cache is empty
        const listOptions: { prefix: string; limit?: number } = { prefix: 'reports:' };
        if (limit && limit > 20) {
            // Only limit KV keys for large requests
            listOptions.limit = Math.min(limit * 3, 100);
        }

        const { keys } = await reportsCache.list(listOptions);
        if (keys.length === 0) {
            console.log('No reports found in REPORTS_CACHE');
            return [];
        }

        const keyNames = keys.map((key: { name: string }) => key.name);
        const batchResults = await this.cacheManager.batchGet<Report[]>('REPORTS_CACHE', keyNames);
        const reports = Array.from(batchResults.values()).map(item => item ?? []);

        const allReports = reports.flat();

        // Use the original groupAndSortReports logic to prioritize today's reports by message count
        const sortedReports = groupAndSortReports(allReports);

        // Apply limit after proper sorting if specified
        return limit ? sortedReports.slice(0, limit) : sortedReports;
    }

    async getAllReportsForChannelFromCache(channelId: string, timeframe?: TimeframeKey): Promise<Report[]> {
        if (timeframe) {
            const reports = await this.getReportsFromCache(channelId, timeframe);
            return reports || [];
        }

        const reportsCache = this.cacheManager.getKVNamespace('REPORTS_CACHE');
        if (!reportsCache) {
            console.log('REPORTS_CACHE namespace not available');
            return [];
        }

        const { keys } = await reportsCache.list({ prefix: `reports:${channelId}:` });
        if (keys.length === 0) {
            return [];
        }
        const keyNames = keys.map((key: { name: string }) => key.name);
        const batchResults = await this.cacheManager.batchGet<Report[]>('REPORTS_CACHE', keyNames);
        const reports = Array.from(batchResults.values()).map(item => item ?? []);
        return reports.flat();
    }

    /**
     * Cache the top reports from the latest cron run for homepage display
     */
    async cacheHomepageReports(reports: Report[]): Promise<void> {
        const key = 'homepage:latest-reports';
        const topReports = reports.slice(0, 10); // Store top 10 reports
        await this.cacheManager.put('REPORTS_CACHE', key, topReports, CACHE.TTL.REPORTS);
        console.log(`[REPORTS] Cached ${topReports.length} reports for homepage`);
    }

    /**
     * Get cached homepage reports from the latest cron run
     */
    async getHomepageReports(): Promise<Report[] | null> {
        const key = 'homepage:latest-reports';
        return this.cacheManager.get<Report[]>('REPORTS_CACHE', key);
    }
} 