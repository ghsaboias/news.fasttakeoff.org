import { Cloudflare, KVNamespace } from '../../worker-configuration';

export class CacheManager {
    constructor(private env: Cloudflare.Env) { }

    async get<T>(namespace: keyof Cloudflare.Env, key: string): Promise<T | null> {
        const cache = this.env[namespace] as KVNamespace;
        return cache?.get<T>(key, { type: 'json' }) ?? null;
    }

    async put<T>(namespace: keyof Cloudflare.Env, key: string, value: T, ttl: number): Promise<void> {
        const cache = this.env[namespace] as KVNamespace;
        if (cache) {
            await cache.put(key, JSON.stringify(value), { expirationTtl: ttl });
        }
    }

    async refreshInBackground<T>(
        key: string,
        namespace: keyof Cloudflare.Env,
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