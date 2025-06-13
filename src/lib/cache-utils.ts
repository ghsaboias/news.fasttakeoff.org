import { Cloudflare, KVNamespace } from '../../worker-configuration';

// Request-level cache to prevent duplicate KV operations
const requestCache = new Map<string, unknown>();

export class CacheManager {
    private readonly env: Cloudflare.Env;

    constructor(env: Cloudflare.Env) {
        this.env = env;
    }

    // Clear request cache (call this at the start of each request)
    static clearRequestCache(): void {
        requestCache.clear();
    }

    // Generate cache key for request-level memoization
    private getRequestCacheKey(namespace: string, key: string): string {
        return `${namespace}:${key}`;
    }

    // Add timeout wrapper for KV operations
    private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
        const timeoutPromise = new Promise<T>((_, reject) => {
            setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        try {
            return await Promise.race([promise, timeoutPromise]);
        } catch (error) {
            console.warn(`[CACHE] Operation timed out, using fallback:`, error);
            return fallback;
        }
    }

    async get<T>(namespace: keyof Cloudflare.Env, key: string, timeoutMs: number = 5000): Promise<T | null> {
        // Check request-level cache first
        const requestCacheKey = this.getRequestCacheKey(namespace as string, key);
        if (requestCache.has(requestCacheKey)) {
            console.log(`[CACHE] Request cache hit for ${requestCacheKey}`);
            return requestCache.get(requestCacheKey) as T | null;
        }

        const cache = this.env[namespace] as KVNamespace;
        if (!cache) return null;

        const operation = cache.get<T>(key, { type: 'json' });
        const result = await this.withTimeout(operation, timeoutMs, null);

        // Cache the result for this request
        requestCache.set(requestCacheKey, result);

        return result;
    }

    async put<T>(namespace: keyof Cloudflare.Env, key: string, value: T, ttl: number): Promise<void> {
        const cache = this.env[namespace] as KVNamespace;
        if (cache) {
            // Don't timeout PUT operations as they're fire-and-forget
            await cache.put(key, JSON.stringify(value), { expirationTtl: ttl });

            // Update request cache
            const requestCacheKey = this.getRequestCacheKey(namespace as string, key);
            requestCache.set(requestCacheKey, value);
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

    async batchGet<T>(namespace: keyof Cloudflare.Env, keys: string[], timeoutMs: number = 1500): Promise<Map<string, T | null>> {
        const cache = this.env[namespace] as KVNamespace;
        if (!cache) return new Map();

        // Check request cache for each key
        const results = new Map<string, T | null>();
        const keysToFetch: string[] = [];

        for (const key of keys) {
            const requestCacheKey = this.getRequestCacheKey(namespace as string, key);
            if (requestCache.has(requestCacheKey)) {
                results.set(key, requestCache.get(requestCacheKey) as T | null);
            } else {
                keysToFetch.push(key);
            }
        }

        if (keysToFetch.length === 0) {
            console.log(`[CACHE] All ${keys.length} keys found in request cache`);
            return results;
        }

        console.log(`[CACHE] Fetching ${keysToFetch.length}/${keys.length} keys from KV`);

        const operations = keysToFetch.map(key => cache.get<T>(key, { type: 'json' }));
        const batchOperation = Promise.all(operations);

        try {
            const kvResults = await this.withTimeout(batchOperation, timeoutMs, keysToFetch.map(() => null));

            // Store results in both maps
            keysToFetch.forEach((key, index) => {
                const result = kvResults[index] ?? null;
                results.set(key, result);

                // Cache in request cache
                const requestCacheKey = this.getRequestCacheKey(namespace as string, key);
                requestCache.set(requestCacheKey, result);
            });

            return results;
        } catch (error) {
            console.warn(`[CACHE] Batch operation failed:`, error);
            // Fill remaining keys with null
            keysToFetch.forEach(key => results.set(key, null));
            return results;
        }
    }

    async list(namespace: keyof Cloudflare.Env, options: { prefix?: string; limit?: number } = {}, timeoutMs: number = 5000): Promise<{ keys: Array<{ name: string; expiration?: number; metadata?: unknown }> }> {
        const cache = this.env[namespace] as KVNamespace;
        if (!cache) return { keys: [] };

        const operation = cache.list(options);
        const result = await this.withTimeout(
            operation,
            timeoutMs,
            { list_complete: true, keys: [], cacheStatus: null }
        );
        return result;
    }

    async delete(namespace: keyof Cloudflare.Env, key: string, timeoutMs: number = 5000): Promise<void> {
        const cache = this.env[namespace] as KVNamespace;
        if (!cache) return;

        const operation = cache.delete(key);
        await this.withTimeout(operation, timeoutMs, undefined);

        // Remove from request cache if present
        const requestCacheKey = this.getRequestCacheKey(namespace as string, key);
        requestCache.delete(requestCacheKey);
    }

    async putRaw(namespace: keyof Cloudflare.Env, key: string, value: string, options: { expirationTtl?: number } = {}): Promise<void> {
        const cache = this.env[namespace] as KVNamespace;
        if (cache) {
            await cache.put(key, value, options);

            // Update request cache with the raw string
            const requestCacheKey = this.getRequestCacheKey(namespace as string, key);
            requestCache.set(requestCacheKey, value);
        }
    }

    getKVNamespace(namespace: keyof Cloudflare.Env): KVNamespace | null {
        return this.env[namespace] as KVNamespace || null;
    }
}