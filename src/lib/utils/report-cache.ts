import { CACHE, TIME, TimeframeKey } from '@/lib/config';
import { Report } from '@/lib/types/core';
import { groupAndSortReports } from '@/lib/utils';
import { Cloudflare } from '../../../worker-configuration';
import { CacheManager } from '../cache-utils';

export class ReportCache {
    static async store(channelId: string, timeframe: TimeframeKey, reports: Report[], env: Cloudflare.Env): Promise<void> {
        if (!env.REPORTS_CACHE) {
            throw new Error('Missing required KV namespace: REPORTS_CACHE');
        }
        const cacheManager = new CacheManager(env);
        const key = `reports:${channelId}:${timeframe}`;
        const cleanedReports = this.cleanupOldReports(reports);
        await cacheManager.put('REPORTS_CACHE', key, cleanedReports, CACHE.TTL.REPORTS);
    }

    static async get(channelId: string, timeframe: TimeframeKey, env: Cloudflare.Env): Promise<Report[] | null> {
        if (!env.REPORTS_CACHE) return null;
        const cacheManager = new CacheManager(env);
        const key = `reports:${channelId}:${timeframe}`;
        return cacheManager.get<Report[]>('REPORTS_CACHE', key);
    }

    static async getPreviousReports(channelId: string, timeframe: TimeframeKey, env: Cloudflare.Env): Promise<Report[]> {
        const allCachedReports = await this.get(channelId, timeframe, env) || [];

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

    static async batchGet(keys: string[], env: Cloudflare.Env): Promise<Map<string, Report[] | null>> {
        if (!env.REPORTS_CACHE) return new Map();
        const cacheManager = new CacheManager(env);
        return cacheManager.batchGet<Report[]>('REPORTS_CACHE', keys);
    }

    static async getAllReports(env: Cloudflare.Env, limit?: number): Promise<Report[]> {
        if (!env.REPORTS_CACHE) {
            console.log('REPORTS_CACHE namespace not available');
            return [];
        }

        const startTime = Date.now();
        const cacheManager = new CacheManager(env);

        // For homepage requests (small limits), try to use cached homepage reports first
        if (limit && limit <= 20) {
            try {
                const homepageReports = await this.getHomepageReports(env);
                if (homepageReports && homepageReports.length > 0) {
                    return homepageReports.slice(0, limit);
                }
                console.log('[REPORTS] No cached homepage reports found, falling back to optimized fetch');
            } catch (error) {
                console.warn('[REPORTS] Homepage cache failed, falling back:', error);
            }
        }

        if (limit && limit <= 10) {
            try {
                const recentKeys = await this.getRecentReportKeys(limit * 2, env);
                if (recentKeys.length > 0) {
                    const batchResults = await cacheManager.batchGet<Report[]>('REPORTS_CACHE', recentKeys, 1200);
                    const reports = Array.from(batchResults.values()).map(item => item ?? []);
                    const allReports = reports.flat();
                    const sortedReports = groupAndSortReports(allReports);
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
            const { keys } = await env.REPORTS_CACHE.list(listOptions);
            if (keys.length === 0) {
                console.log('No reports found in REPORTS_CACHE');
                return [];
            }

            const keyNames = keys.map((key: { name: string }) => key.name);
            const batchResults = await cacheManager.batchGet<Report[]>('REPORTS_CACHE', keyNames, 1500);
            const reports = Array.from(batchResults.values()).map(item => item ?? []);

            const allReports = reports.flat();

            // Use the original groupAndSortReports logic to prioritize today's reports by message count
            const sortedReports = groupAndSortReports(allReports);

            // Apply limit after proper sorting if specified
            return limit ? sortedReports.slice(0, limit) : sortedReports;
        } catch (error) {
            console.error('[REPORTS] All fetch methods failed:', error);
            return [];
        }
    }

    static async getAllReportsForChannel(channelId: string, env: Cloudflare.Env, timeframe?: TimeframeKey): Promise<Report[]> {
        if (!env.REPORTS_CACHE) {
            console.log('REPORTS_CACHE namespace not available');
            return [];
        }

        if (timeframe) {
            const reports = await this.get(channelId, timeframe, env);
            return reports || [];
        }

        const cacheManager = new CacheManager(env);
        const { keys } = await env.REPORTS_CACHE.list({ prefix: `reports:${channelId}:` });
        if (keys.length === 0) {
            return [];
        }
        const keyNames = keys.map((key: { name: string }) => key.name);
        const batchResults = await cacheManager.batchGet<Report[]>('REPORTS_CACHE', keyNames);
        const reports = Array.from(batchResults.values()).map(item => item ?? []);
        return reports.flat();
    }

    static async storeHomepageReports(reports: Report[], env: Cloudflare.Env): Promise<void> {
        if (!env.REPORTS_CACHE) return;

        try {
            const cacheManager = new CacheManager(env);
            const key = 'homepage:latest-reports';
            const topReports = reports.slice(0, 10); // Store top 10 reports

            // Use longer TTL for homepage cache to ensure availability
            await cacheManager.put('REPORTS_CACHE', key, topReports, CACHE.TTL.REPORTS);

            // Also cache a backup with shorter TTL for immediate availability
            const backupKey = 'homepage:backup-reports';
            await cacheManager.put('REPORTS_CACHE', backupKey, topReports, 3600); // 1 hour backup

            console.log(`[REPORTS] Cached ${topReports.length} reports for homepage (primary + backup)`);
        } catch (error) {
            console.error('[REPORTS] Failed to cache homepage reports:', error);
        }
    }

    static async getHomepageReports(env: Cloudflare.Env): Promise<Report[] | null> {
        if (!env.REPORTS_CACHE) return null;

        try {
            const cacheManager = new CacheManager(env);
            const key = 'homepage:latest-reports';
            const reports = await cacheManager.get<Report[]>('REPORTS_CACHE', key, 2000); // 2000ms timeout

            if (reports && reports.length > 0) {
                return reports;
            }

            // Fallback to backup cache
            console.log('[REPORTS] Primary homepage cache empty, trying backup');
            const backupKey = 'homepage:backup-reports';
            const backupReports = await cacheManager.get<Report[]>('REPORTS_CACHE', backupKey, 800);

            return backupReports || null;
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
            console.log(`[REPORTS] Cleaned up ${removedCount} reports older than ${CACHE.RETENTION.REPORTS / (24 * 60 * 60)} days`);
        }

        return filteredReports;
    }

    private static async getRecentReportKeys(limit: number, env: Cloudflare.Env): Promise<string[]> {
        if (!env.REPORTS_CACHE) return [];

        // Get a small list of recent keys
        const { keys } = await env.REPORTS_CACHE.list({
            prefix: 'reports:',
            limit: Math.min(limit * 3, 30) // Conservative limit for speed
        });

        return keys.map((key: { name: string }) => key.name);
    }
}
