interface CloudflareEnv {
    NEXT_CACHE_WORKERS_KV: KVNamespace;
    NEXTJS_ENV: string;
    ASSETS: Fetcher;
}

declare global {
    interface GlobalThis {
        env?: CloudflareEnv;
    }
    namespace NodeJS {
        interface ProcessEnv {
            NEXT_PUBLIC_API_URL?: string; // Your existing env var
        }
    }
}