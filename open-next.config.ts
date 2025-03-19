// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";
import kvIncrementalCache from "@opennextjs/cloudflare/kv-cache";
import memoryQueue from "@opennextjs/cloudflare/memory-queue";
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  queue: memoryQueue,
});
