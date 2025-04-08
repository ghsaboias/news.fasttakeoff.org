import type { CloudflareEnv, KVNamespace } from '@cloudflare/types';

export class CacheManager {
    constructor(private env: CloudflareEnv) { }

    async get<T>(namespace: keyof CloudflareEnv, key: string): Promise<T | null> {
        const cache = this.env[namespace] as KVNamespace;
        return cache?.get<T>(key, { type: 'json' }) ?? null;
    }

    async put<T>(namespace: keyof CloudflareEnv, key: string, value: T, ttl: number): Promise<void> {
        const cache = this.env[namespace] as KVNamespace;
        if (cache) {
            await cache.put(key, JSON.stringify(value), { expirationTtl: ttl });
        }
    }

    async refreshInBackground<T>(
        key: string,
        namespace: keyof CloudflareEnv,
        fetchFn: () => Promise<T>,
        ttl: number
    ): Promise<void> {
        try {
            const data = await fetchFn();
            await this.put(namespace, key, data, ttl);
        } catch (err) {
            console.error(`[CacheManager] Background refresh failed for ${key}:`, err);
        }
    }
}