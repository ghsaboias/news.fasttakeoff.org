/**
 * D1MessagesService
 * Phase 2: Core Implementation - Discord Messages Migration
 * 
 * Provides essential CRUD operations for Discord messages in D1 database
 * Part of hybrid D1+KV architecture for 68% storage reduction
 */

import type { EssentialDiscordMessage } from '@/lib/utils/message-transformer';
import type { Cloudflare } from '../../../worker-configuration';

export interface D1MessageRow {
  id?: number;
  message_id: string;
  channel_id: string;
  content: string;
  timestamp: string;
  author_username: string;
  author_discriminator: string;
  author_global_name: string | null;
  referenced_message_content: string | null;
  embeds: string | null; // JSON string
  attachments: string | null; // JSON string  
  reaction_summary: string | null; // JSON string
  created_at?: number;
  updated_at?: number;
}

export class D1MessagesService {
  private db: Cloudflare.Env['FAST_TAKEOFF_NEWS_DB'];

  constructor(env: Cloudflare.Env) {
    if (!env.FAST_TAKEOFF_NEWS_DB) {
      throw new Error('Missing required D1 database: FAST_TAKEOFF_NEWS_DB');
    }
    this.db = env.FAST_TAKEOFF_NEWS_DB;
  }

  /**
   * Create a new message in D1 database
   */
  async createMessage(message: EssentialDiscordMessage): Promise<void> {
    const row: D1MessageRow = {
      message_id: message.id,
      channel_id: message.channel_id,
      content: message.content,
      timestamp: message.timestamp,
      author_username: message.author_username,
      author_discriminator: message.author_discriminator,
      author_global_name: message.author_global_name,
      referenced_message_content: message.referenced_message_content,
      embeds: message.embeds ? JSON.stringify(message.embeds) : null,
      attachments: message.attachments ? JSON.stringify(message.attachments) : null,
      reaction_summary: message.reaction_summary ? JSON.stringify(message.reaction_summary) : null,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000)
    };

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO messages (
        message_id, channel_id, content, timestamp,
        author_username, author_discriminator, author_global_name,
        referenced_message_content, embeds, attachments, reaction_summary,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      row.message_id,
      row.channel_id,
      row.content,
      row.timestamp,
      row.author_username,
      row.author_discriminator,
      row.author_global_name,
      row.referenced_message_content,
      row.embeds,
      row.attachments,
      row.reaction_summary,
      row.created_at,
      row.updated_at
    ).run();
  }

  /**
   * Batch create multiple messages in a single transaction
   * Optimized for bulk inserts - up to 100x faster than individual inserts
   */
  async batchCreateMessages(messages: EssentialDiscordMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const BATCH_SIZE = 100;
    const now = Math.floor(Date.now() / 1000);

    // Process in batches to stay within D1 limits
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);

      const statements = batch.map(message => {
        return this.db.prepare(`
          INSERT OR IGNORE INTO messages (
            message_id, channel_id, content, timestamp,
            author_username, author_discriminator, author_global_name,
            referenced_message_content, embeds, attachments, reaction_summary,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          message.id,
          message.channel_id,
          message.content,
          message.timestamp,
          message.author_username,
          message.author_discriminator,
          message.author_global_name,
          message.referenced_message_content,
          message.embeds ? JSON.stringify(message.embeds) : null,
          message.attachments ? JSON.stringify(message.attachments) : null,
          message.reaction_summary ? JSON.stringify(message.reaction_summary) : null,
          now,
          now
        );
      });

      await this.db.batch(statements);
    }
  }

  /**
   * Get messages within a time window (for dynamic report generation)
   */
  async getMessagesInTimeWindow(
    channelId: string, 
    startTime: Date, 
    endTime: Date
  ): Promise<EssentialDiscordMessage[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE channel_id = ? 
      AND timestamp >= ? 
      AND timestamp <= ?
      ORDER BY timestamp DESC
    `);

    const result = await stmt.bind(
      channelId,
      startTime.toISOString(),
      endTime.toISOString()
    ).all();

    if (!result.success) {
      throw new Error(`Failed to query messages: ${result.error || 'Unknown error'}`);
    }

    return result.results.map((row: unknown) => this.rowToEssentialMessage(row as D1MessageRow));
  }

  /**
   * Get specific messages by IDs (for report reconstruction)
   * Handles SQLite variable limit by batching large ID arrays
   */
  async getMessagesByIds(messageIds: string[]): Promise<EssentialDiscordMessage[]> {
    if (messageIds.length === 0) return [];

    // Cloudflare D1 has a 100 parameter limit per query - batch accordingly
    const BATCH_SIZE = 50;
    const allResults: EssentialDiscordMessage[] = [];

    // Process in batches to avoid SQL variable limit
    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const batchIds = messageIds.slice(i, i + BATCH_SIZE);

      // Build parameterized query for this batch
      const placeholders = batchIds.map(() => '?').join(',');
      const stmt = this.db.prepare(`
        SELECT * FROM messages
        WHERE message_id IN (${placeholders})
        ORDER BY timestamp DESC
      `);

      const result = await stmt.bind(...batchIds).all();

      if (!result.success) {
        throw new Error(`Failed to query messages batch ${i}-${i + batchIds.length}: ${result.error || 'Unknown error'}`);
      }

      const batchResults = result.results.map((row: unknown) => this.rowToEssentialMessage(row as D1MessageRow));
      allResults.push(...batchResults);
    }

    // Sort all results by timestamp DESC since we processed in batches
    return allResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Update an existing message
   */
  async updateMessage(message: EssentialDiscordMessage): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE messages SET
        content = ?,
        embeds = ?,
        attachments = ?,
        reaction_summary = ?,
        updated_at = ?
      WHERE message_id = ?
    `);

    await stmt.bind(
      message.content,
      message.embeds ? JSON.stringify(message.embeds) : null,
      message.attachments ? JSON.stringify(message.attachments) : null,
      message.reaction_summary ? JSON.stringify(message.reaction_summary) : null,
      Math.floor(Date.now() / 1000),
      message.id
    ).run();
  }

  /**
   * Delete a message by ID
   */
  async deleteMessage(messageId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM messages WHERE message_id = ?');
    await stmt.bind(messageId).run();
  }

  /**
   * Get message count for a channel (for validation)
   */
  async getMessageCount(channelId: string): Promise<number> {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE channel_id = ?'
    );
    
    const result = await stmt.bind(channelId).first();
    return (result?.count as number) || 0;
  }

  /**
   * Get latest message timestamp for a channel (for cache invalidation)
   */
  async getLatestTimestamp(channelId: string): Promise<string | null> {
    const stmt = this.db.prepare(`
      SELECT timestamp FROM messages 
      WHERE channel_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
    
    const result = await stmt.bind(channelId).first();
    return (result?.timestamp as string) || null;
  }

  /**
   * Convert D1 row to EssentialDiscordMessage
   */
  private rowToEssentialMessage(row: D1MessageRow): EssentialDiscordMessage {
    return {
      id: row.message_id,
      content: row.content,
      timestamp: row.timestamp,
      channel_id: row.channel_id,
      author_username: row.author_username,
      author_discriminator: row.author_discriminator,
      author_global_name: row.author_global_name,
      referenced_message_content: row.referenced_message_content,
      reaction_summary: row.reaction_summary ? JSON.parse(row.reaction_summary) : null,
      embeds: row.embeds ? JSON.parse(row.embeds) : null,
      attachments: row.attachments ? JSON.parse(row.attachments) : null
    };
  }

  /**
   * Health check - verify database connection and table exists
   */
  async healthCheck(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db.prepare('SELECT COUNT(*) as count FROM messages LIMIT 1').first();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown database error' 
      };
    }
  }
}