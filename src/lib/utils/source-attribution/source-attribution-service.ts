import { CacheManager } from '@/lib/cache-utils';
import { CACHE } from '@/lib/config';
import { DiscordMessage, Report, ReportSourceAttribution } from '@/lib/types/core';
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
        sourceMessages: DiscordMessage[]
    ): Promise<ReportSourceAttribution> {
        const cacheKey = `attribution:${report.reportId}`;

        // Try to get from cache first
        const cached = await this.cache.get<ReportSourceAttribution>('REPORTS_CACHE', cacheKey);
        if (cached) {
            console.log(`[SOURCE_ATTRIBUTION] Cache hit for report ${report.reportId}`);
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
        sourceMessages: DiscordMessage[],
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
     * Pre-generate attributions for multiple reports (for background processing)
     */
    async preGenerateAttributions(
        reports: Report[],
        messagesByReportId: Map<string, DiscordMessage[]>
    ): Promise<void> {
        console.log(`[SOURCE_ATTRIBUTION] Pre-generating attributions for ${reports.length} reports`);

        let successCount = 0;
        let errorCount = 0;

        // Process in parallel but limit concurrency
        const BATCH_SIZE = 3;
        for (let i = 0; i < reports.length; i += BATCH_SIZE) {
            const batch = reports.slice(i, i + BATCH_SIZE);

            const results = await Promise.allSettled(
                batch.map(async (report) => {
                    const sourceMessages = messagesByReportId.get(report.reportId) || [];
                    if (sourceMessages.length > 0) {
                        await this.getAttributions(report, sourceMessages);
                        return { success: true, reportId: report.reportId };
                    } else {
                        console.warn(`[SOURCE_ATTRIBUTION] No source messages for report ${report.reportId}, skipping`);
                        return { success: false, reportId: report.reportId, reason: 'no_messages' };
                    }
                })
            );

            // Track results
            results.forEach((result, index) => {
                const report = batch[index];
                if (result.status === 'fulfilled' && result.value.success) {
                    successCount++;
                } else {
                    errorCount++;
                    const reason = result.status === 'rejected' ? result.reason : (result.value.reason || 'unknown');
                    console.warn(`[SOURCE_ATTRIBUTION] Failed for report ${report.reportId}:`, reason);
                }
            });

            // Small delay between batches to avoid overwhelming the AI API
            if (i + BATCH_SIZE < reports.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`[SOURCE_ATTRIBUTION] Completed attribution generation: ${successCount} succeeded, ${errorCount} failed`);
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
