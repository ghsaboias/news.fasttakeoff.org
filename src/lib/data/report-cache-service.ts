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
        const startTime = Date.now();
        const reportsCache = this.cacheManager.getKVNamespace('REPORTS_CACHE');
        if (!reportsCache) {
            console.log('REPORTS_CACHE namespace not available');
            return [];
        }

        // For homepage requests (small limits), try to use cached homepage reports first
        if (limit && limit <= 20) {
            try {
                const homepageReports = await this.getHomepageReports();
                if (homepageReports && homepageReports.length > 0) {
                    console.log(`[REPORTS] Using cached homepage reports (${homepageReports.length} available) in ${Date.now() - startTime}ms`);
                    return homepageReports.slice(0, limit);
                }
                console.log('[REPORTS] No cached homepage reports found, falling back to optimized fetch');
            } catch (error) {
                console.warn('[REPORTS] Homepage cache failed, falling back:', error);
            }
        }

        // Optimized fallback: Use smaller KV operations for homepage requests
        if (limit && limit <= 10) {
            try {
                // For small requests, try to get recent reports more efficiently
                const recentKeys = await this.getRecentReportKeys(limit * 2); // Get 2x to account for filtering
                if (recentKeys.length > 0) {
                    const batchResults = await this.cacheManager.batchGet<Report[]>('REPORTS_CACHE', recentKeys, 800);
                    const reports = Array.from(batchResults.values()).map(item => item ?? []);
                    const allReports = reports.flat();
                    const sortedReports = groupAndSortReports(allReports);
                    console.log(`[REPORTS] Used optimized fetch for ${recentKeys.length} keys in ${Date.now() - startTime}ms`);
                    return sortedReports.slice(0, limit);
                }
            } catch (error) {
                console.warn('[REPORTS] Optimized fetch failed, falling back to full scan:', error);
            }
        }

        // Original fallback logic for larger requests or when optimized methods fail
        const listOptions: { prefix: string; limit?: number } = { prefix: 'reports:' };
        if (limit && limit > 20) {
            // Only limit KV keys for large requests
            listOptions.limit = Math.min(limit * 3, 100);
        } else {
            // For homepage, limit to reduce scan time
            listOptions.limit = 50;
        }

        try {
            const { keys } = await reportsCache.list(listOptions);
            if (keys.length === 0) {
                console.log('No reports found in REPORTS_CACHE');
                return [];
            }

            const keyNames = keys.map((key: { name: string }) => key.name);
            const batchResults = await this.cacheManager.batchGet<Report[]>('REPORTS_CACHE', keyNames, 1500);
            const reports = Array.from(batchResults.values()).map(item => item ?? []);

            const allReports = reports.flat();

            // Use the original groupAndSortReports logic to prioritize today's reports by message count
            const sortedReports = groupAndSortReports(allReports);

            console.log(`[REPORTS] Full scan completed in ${Date.now() - startTime}ms`);
            // Apply limit after proper sorting if specified
            return limit ? sortedReports.slice(0, limit) : sortedReports;
        } catch (error) {
            console.error('[REPORTS] All fetch methods failed:', error);
            return [];
        }
    }

    // Helper method to get recent report keys more efficiently
    private async getRecentReportKeys(limit: number): Promise<string[]> {
        const reportsCache = this.cacheManager.getKVNamespace('REPORTS_CACHE');
        if (!reportsCache) return [];

        // Get a small list of recent keys
        const { keys } = await reportsCache.list({
            prefix: 'reports:',
            limit: Math.min(limit * 3, 30) // Conservative limit for speed
        });

        return keys.map((key: { name: string }) => key.name);
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
        try {
            const key = 'homepage:latest-reports';
            const topReports = reports.slice(0, 10); // Store top 10 reports

            // Use longer TTL for homepage cache to ensure availability
            await this.cacheManager.put('REPORTS_CACHE', key, topReports, CACHE.TTL.REPORTS);

            // Also cache a backup with shorter TTL for immediate availability
            const backupKey = 'homepage:backup-reports';
            await this.cacheManager.put('REPORTS_CACHE', backupKey, topReports, 3600); // 1 hour backup

            console.log(`[REPORTS] Cached ${topReports.length} reports for homepage (primary + backup)`);
        } catch (error) {
            console.error('[REPORTS] Failed to cache homepage reports:', error);
        }
    }

    /**
     * Get cached homepage reports from the latest cron run
     */
    async getHomepageReports(): Promise<Report[] | null> {
        try {
            const key = 'homepage:latest-reports';
            const reports = await this.cacheManager.get<Report[]>('REPORTS_CACHE', key, 300); // 300ms timeout

            if (reports && reports.length > 0) {
                return reports;
            }

            // Fallback to backup cache
            console.log('[REPORTS] Primary homepage cache empty, trying backup');
            const backupKey = 'homepage:backup-reports';
            const backupReports = await this.cacheManager.get<Report[]>('REPORTS_CACHE', backupKey, 300);

            return backupReports || null;
        } catch (error) {
            console.warn('[REPORTS] Failed to get homepage reports:', error);
            return null;
        }
    }
} 