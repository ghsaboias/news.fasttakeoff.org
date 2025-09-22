import { CacheManager } from '@/lib/cache-utils';
import { CACHE } from '@/lib/config';
import { EssentialDiscordMessage } from '@/lib/utils/message-transformer';
import { Report, ReportSourceAttribution } from '@/lib/types/reports';
import { Cloudflare } from '../../../../worker-configuration';
import { SourceAttributionAI } from './source-attribution-ai';

const GENERATION_LOCKS = new Map<string, Promise<ReportSourceAttribution>>();

/**
 * Service for managing source attributions with caching
 */
export class SourceAttributionService {
    private env: Cloudflare.Env;
    private cache: CacheManager;

    constructor(env: Cloudflare.Env) {
        this.env = env;
        this.cache = new CacheManager(env);
    }

    /**
     * Get source attributions for a report, generating them if not cached
     */
    async getAttributions(
        report: Report,
        sourceMessages: EssentialDiscordMessage[]
    ): Promise<ReportSourceAttribution> {
        const cacheKey = `attribution:${report.reportId}`;

        // Try to get from cache first
        const cached = await this.cache.get<ReportSourceAttribution>('REPORTS_CACHE', cacheKey);
        if (cached) {
            return cached;
        }

        // Check if there's already a generation in progress
        const existingLock = GENERATION_LOCKS.get(report.reportId);
        if (existingLock) {
            console.log(`[SOURCE_ATTRIBUTION] Using existing generation lock for report ${report.reportId}`);
            return existingLock;
        }

        // Create new generation lock
        const generationPromise = this.generateAndCacheAttributions(report, sourceMessages, cacheKey);
        GENERATION_LOCKS.set(report.reportId, generationPromise);

        try {
            const result = await generationPromise;
            return result;
        } finally {
            // Clean up lock after generation completes or fails
            GENERATION_LOCKS.delete(report.reportId);
        }
    }

    private async generateAndCacheAttributions(
        report: Report,
        sourceMessages: EssentialDiscordMessage[],
        cacheKey: string
    ): Promise<ReportSourceAttribution> {
        try {
            // Generate new attributions
            const attributions = await SourceAttributionAI.generateAttributions(
                report,
                sourceMessages,
                this.env
            );

            // Validate attributions before caching
            if (attributions.attributions.length === 0) {
                console.warn(`[SOURCE_ATTRIBUTION] Generated empty attributions for report ${report.reportId}, not caching`);
                return attributions;
            }

            // Cache successful result
            await this.cache.put(
                'REPORTS_CACHE',
                cacheKey,
                attributions,
                CACHE.TTL.REPORTS
            );

            return attributions;
        } catch (error) {
            console.error(`[SOURCE_ATTRIBUTION] Failed to generate attributions for report ${report.reportId}:`, error);

            // Check if we have a previous cached version before falling back to empty
            const previousCached = await this.cache.get<ReportSourceAttribution>('REPORTS_CACHE', cacheKey);
            if (previousCached) {
                console.log(`[SOURCE_ATTRIBUTION] Using previous cached version for report ${report.reportId}`);
                return previousCached;
            }

            // Return empty attribution as last resort, but don't cache it
            const fallbackAttribution: ReportSourceAttribution = {
                reportId: report.reportId,
                attributions: [],
                generatedAt: new Date().toISOString(),
                version: '3.0'
            };

            return fallbackAttribution;
        }
    }

    /**
     * Clear attribution cache for a specific report
     */
    async clearAttributionCache(reportId: string): Promise<void> {
        const cacheKey = `attribution:${reportId}`;
        await this.cache.delete('REPORTS_CACHE', cacheKey);
        GENERATION_LOCKS.delete(reportId); // Also clear any existing lock
        console.log(`[SOURCE_ATTRIBUTION] Cleared cache for report ${reportId}`);
    }

    /**
     * Get attribution statistics for monitoring
     */
    async getAttributionStats(): Promise<{
        totalAttributions: number;
        avgConfidence: number;
        coveragePercentage: number;
    }> {
        // This would require scanning all cached attributions
        // Implementation depends on your monitoring needs
        return {
            totalAttributions: 0,
            avgConfidence: 0,
            coveragePercentage: 0
        };
    }
}
