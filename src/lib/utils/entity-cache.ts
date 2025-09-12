import { CACHE } from '@/lib/config';
import { EntityExtractionResult } from '@/lib/types/entities';
import { Cloudflare } from '../../../worker-configuration';
import { CacheManager } from '../cache-utils';

export class EntityCache {
    /**
     * Store entity extraction result for a report
     */
    static async store(reportId: string, entities: EntityExtractionResult, env: Cloudflare.Env): Promise<void> {
        if (!env.ENTITIES_CACHE) {
            throw new Error('Missing required KV namespace: ENTITIES_CACHE');
        }
        const cacheManager = new CacheManager(env);
        const key = `entities:${reportId}`;
        await cacheManager.put('ENTITIES_CACHE', key, entities, CACHE.TTL.ENTITIES);
    }

    /**
     * Get cached entity extraction result for a report
     */
    static async get(reportId: string, env: Cloudflare.Env): Promise<EntityExtractionResult | null> {
        if (!env.ENTITIES_CACHE) {
            console.warn('ENTITIES_CACHE namespace not available');
            return null;
        }
        const cacheManager = new CacheManager(env);
        const key = `entities:${reportId}`;
        return cacheManager.get<EntityExtractionResult>('ENTITIES_CACHE', key);
    }

    /**
     * Batch get entity extraction results for multiple reports
     */
    static async batchGet(reportIds: string[], env: Cloudflare.Env): Promise<Map<string, EntityExtractionResult | null>> {
        if (!env.ENTITIES_CACHE) {
            console.warn('ENTITIES_CACHE namespace not available');
            return new Map();
        }
        const cacheManager = new CacheManager(env);
        const keys = reportIds.map(id => `entities:${id}`);
        const results = await cacheManager.batchGet<EntityExtractionResult>('ENTITIES_CACHE', keys);

        // Convert back to reportId-keyed map
        const entityMap = new Map<string, EntityExtractionResult | null>();
        reportIds.forEach((reportId, index) => {
            const key = keys[index];
            entityMap.set(reportId, results.get(key) || null);
        });

        return entityMap;
    }

    /**
     * Check if entity extraction exists for a report
     */
    static async exists(reportId: string, env: Cloudflare.Env): Promise<boolean> {
        const result = await this.get(reportId, env);
        return result !== null;
    }

    /**
     * Delete entity extraction for a report
     */
    static async delete(reportId: string, env: Cloudflare.Env): Promise<void> {
        if (!env.ENTITIES_CACHE) {
            return;
        }
        const cacheManager = new CacheManager(env);
        const key = `entities:${reportId}`;
        await cacheManager.delete('ENTITIES_CACHE', key);
    }

    /**
     * List all entity cache keys (useful for maintenance)
     */
    static async listKeys(env: Cloudflare.Env): Promise<{ name: string }[]> {
        if (!env.ENTITIES_CACHE) {
            return [];
        }
        const cacheManager = new CacheManager(env);
        const { keys } = await cacheManager.list('ENTITIES_CACHE', { prefix: 'entities:' });
        return keys;
    }

    /**
     * Get entity extraction results for multiple reports efficiently
     * Used when displaying reports with their entities
     */
    static async getForReports(reportIds: string[], env: Cloudflare.Env): Promise<Record<string, EntityExtractionResult>> {
        if (reportIds.length === 0) return {};

        const entityMap = await this.batchGet(reportIds, env);
        const result: Record<string, EntityExtractionResult> = {};

        entityMap.forEach((entities, reportId) => {
            if (entities) {
                result[reportId] = entities;
            }
        });

        return result;
    }
} 