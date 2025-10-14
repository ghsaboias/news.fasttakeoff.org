import { TIME } from '@/lib/config';
import { MktNewsMessage } from '@/lib/types/mktnews';
import { Cloudflare } from '../../../worker-configuration';

export class MktNewsService {
  public env: Cloudflare.Env;

  constructor(env: Cloudflare.Env) {
    this.env = env;
    if (!env.FAST_TAKEOFF_NEWS_DB) {
      throw new Error('Missing required D1 database: FAST_TAKEOFF_NEWS_DB');
    }
  }

  /**
   * Update/refresh MktNews messages
   * In the new architecture, Pi pushes data directly via /api/mktnews/ingest
   * This method is a no-op kept for backwards compatibility with cron jobs
   */
  async updateMessages(): Promise<void> {
    console.log('[MKTNEWS] updateMessages called - using D1 storage (no action needed)');
    // Messages are now stored in D1 via ingest endpoint
    // No cleanup needed - we keep messages indefinitely
  }

  /**
   * Get all cached MktNews messages from D1
   */
  async getCachedMessages(): Promise<MktNewsMessage[]> {
    try {
      const result = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        SELECT raw_data
        FROM mktnews_messages
        ORDER BY received_at DESC
      `).all();

      if (!result.success) {
        console.error('[MKTNEWS] Failed to fetch messages from D1:', result.error);
        return [];
      }

      // Parse raw_data JSON for each message
      const messages = result.results.map((row) => {
        return JSON.parse((row as { raw_data: string }).raw_data) as MktNewsMessage;
      });

      return messages;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[MKTNEWS] Error fetching messages from D1:', errorMessage);
      return [];
    }
  }

  /**
   * Ingest new messages from Pi (public method for API endpoint)
   */
  async ingestMessages(newMessages: MktNewsMessage[]): Promise<number> {
    console.log(`[MKTNEWS] Ingesting ${newMessages.length} messages from Pi into D1`);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const message of newMessages) {
      try {
        // Prepare values with proper escaping
        const messageId = message.data.id;
        const mid = message.data.mid;
        const type = message.type;
        const action = message.data.action;
        const category = JSON.stringify(message.data.category);
        const title = message.data.data.title || '';
        const content = message.data.data.content || '';
        const pic = message.data.data.pic || '';
        const important = message.data.important;
        const timestamp = message.timestamp;
        const time = message.data.time;
        const receivedAt = message.received_at;
        const rawData = JSON.stringify(message);

        await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
          INSERT OR IGNORE INTO mktnews_messages (
            message_id, mid, type, action, category, title, content, pic,
            important, timestamp, time, received_at, raw_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          messageId, mid, type, action, category, title, content, pic,
          important, timestamp, time, receivedAt, rawData
        ).run();

        insertedCount++;
      } catch (error) {
        skippedCount++;
        console.error(`[MKTNEWS] Failed to insert message ${message.data.id}:`, error);
      }
    }

    console.log(`[MKTNEWS] Successfully ingested ${insertedCount} messages (${skippedCount} skipped/duplicates)`);
    return insertedCount;
  }

  /**
   * Deduplicate messages by ID
   */
  public deduplicateMessages(messages: MktNewsMessage[]): MktNewsMessage[] {
    const seen = new Set<string>();
    const deduped: MktNewsMessage[] = [];

    for (const message of messages) {
      if (!seen.has(message.data.id)) {
        seen.add(message.data.id);
        deduped.push(message);
      }
    }

    return deduped;
  }

  /**
   * Get messages for a specific timeframe
   */
  async getMessagesForTimeframe(hours: number): Promise<MktNewsMessage[]> {
    try {
      const cutoffTime = new Date(Date.now() - TIME.hoursToMs(hours)).toISOString();
      console.log(`[MKTNEWS] Filtering for messages after: ${cutoffTime}`);

      const result = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        SELECT raw_data
        FROM mktnews_messages
        WHERE received_at > ?
        ORDER BY received_at DESC
      `).bind(cutoffTime).all();

      if (!result.success) {
        console.error('[MKTNEWS] Failed to fetch messages from D1:', result.error);
        return [];
      }

      const messages = result.results.map((row) => {
        return JSON.parse((row as { raw_data: string }).raw_data) as MktNewsMessage;
      });

      console.log(`[MKTNEWS] Found ${messages.length} messages in ${hours}h timeframe`);
      return messages;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[MKTNEWS] Error fetching messages from D1:', errorMessage);
      return [];
    }
  }

  /**
   * Get recent messages (last 2 hours by default)
   */
  async getRecentMessages(hours: number = 2): Promise<MktNewsMessage[]> {
    return this.getMessagesForTimeframe(hours);
  }

  /**
   * Get statistics about messages in D1
   */
  async getStats(): Promise<{
    totalMessages: number;
    lastMessage: string | null;
    oldestMessage: string | null;
    importantMessages: number;
  }> {
    try {
      // Get total count and important count
      const countResult = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN important = 1 THEN 1 ELSE 0 END) as important_count
        FROM mktnews_messages
      `).first();

      // Get last message timestamp
      const lastMessageResult = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        SELECT received_at
        FROM mktnews_messages
        ORDER BY received_at DESC
        LIMIT 1
      `).first();

      // Get oldest message timestamp
      const oldestMessageResult = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        SELECT received_at
        FROM mktnews_messages
        ORDER BY received_at ASC
        LIMIT 1
      `).first();

      return {
        totalMessages: (countResult?.total as number) || 0,
        lastMessage: (lastMessageResult?.received_at as string) || null,
        oldestMessage: (oldestMessageResult?.received_at as string) || null,
        importantMessages: (countResult?.important_count as number) || 0
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[MKTNEWS] Error getting stats from D1:', errorMessage);
      return {
        totalMessages: 0,
        lastMessage: null,
        oldestMessage: null,
        importantMessages: 0
      };
    }
  }
}
