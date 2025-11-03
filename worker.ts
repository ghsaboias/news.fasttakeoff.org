// worker.ts
// Custom worker that extends the OpenNext-generated worker with scheduled and queue handlers
// See: https://opennext.js.org/cloudflare/howtos/custom-worker

// OpenNext generates .open-next/worker.js at build time
// @ts-ignore
import { default as handler } from "./.open-next/worker.js";
import { scheduled as cronScheduled, queue as queueHandler } from "./src/lib/cron";
import type { Cloudflare } from './worker-configuration';
import type { ExecutionContext, MessageBatch } from './worker-configuration';

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

export default {
  // Re-use the OpenNext-generated fetch handler for all Next.js routes
  fetch: handler.fetch,

  // Cron Triggers: Maps wrangler.toml cron expressions to scheduled tasks
  async scheduled(
    controller: ScheduledController,
    env: Cloudflare.Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Adapt OpenNext's (controller, env, ctx) signature
    // to our cron.ts (event, env, ctx) signature
    const event = {
      scheduledTime: controller.scheduledTime,
      cron: controller.cron,
      waitUntil: (p: Promise<unknown>) => ctx?.waitUntil?.(p),
    };

    return cronScheduled(event, env, ctx);
  },

  // Queue Consumer: Processes financial data jobs from finance_data_queue
  async queue(
    batch: MessageBatch<{
      ticker: string;
      entityId: string;
      name: string;
      marketCap?: number;
      timestamp: string;
    }>,
    env: Cloudflare.Env,
    ctx: ExecutionContext
  ): Promise<void> {
    return queueHandler(batch, env, ctx);
  },
};
