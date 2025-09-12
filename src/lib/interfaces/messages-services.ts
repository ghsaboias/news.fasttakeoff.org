/**
 * Messages Services Interfaces
 * 
 * Interface definitions for D1 messages service, hybrid service, and migration service.
 * These define the contracts that our TDD tests expect to be implemented.
 */

import type { 
  EssentialDiscordMessage, 
  MessageRow,
  MigrationDryRunResult,
  MigrationResult,
  MigrationBatchConfig,
  MigrationValidationResult,
  HybridQueryOptions,
  CacheStats
} from '@/lib/types/messages-migration';

/**
 * D1 Messages Service Interface
 * Handles all direct D1 database operations for messages
 */
export interface ID1MessagesService {
  /**
   * Create a new message in D1
   */
  createMessage(message: EssentialDiscordMessage): Promise<void>;

  /**
   * Get a single message by Discord message ID
   */
  getMessageById(messageId: string): Promise<EssentialDiscordMessage | null>;

  /**
   * Get messages for a specific channel with optional pagination
   */
  getMessagesByChannel(
    channelId: string, 
    options?: { limit?: number; offset?: number; since?: Date; until?: Date }
  ): Promise<EssentialDiscordMessage[]>;

  /**
   * Get messages within a specific time window (critical for dynamic reports)
   */
  getMessagesInTimeWindow(
    channelId: string, 
    windowStart: Date, 
    windowEnd: Date
  ): Promise<EssentialDiscordMessage[]>;

  /**
   * Get multiple messages by their Discord IDs (for report reconstruction)
   */
  getMessagesByIds(messageIds: string[]): Promise<EssentialDiscordMessage[]>;

  /**
   * Update an existing message
   */
  updateMessage(messageId: string, updates: Partial<EssentialDiscordMessage>): Promise<void>;

  /**
   * Delete a message from D1
   */
  deleteMessage(messageId: string): Promise<void>;

  /**
   * Get message count for a channel
   */
  getMessageCount(channelId: string, since?: Date): Promise<number>;

  /**
   * Batch migrate messages from KV format to D1
   */
  migrateFromKV(channelId: string, kvMessages: any[], batchConfig?: MigrationBatchConfig): Promise<void>;

  /**
   * Get the oldest and newest message timestamps for a channel
   */
  getMessageTimeRange(channelId: string): Promise<{ oldest: Date | null; newest: Date | null }>;
}

/**
 * Hybrid Messages Service Interface
 * Provides backward-compatible API while using both KV cache and D1 storage
 */
export interface IHybridMessagesService {
  /**
   * Get messages with intelligent KV/D1 routing
   * Recent messages (< 12h) come from KV cache, older from D1
   */
  getMessages(channelId: string, options?: HybridQueryOptions): Promise<EssentialDiscordMessage[]>;

  /**
   * Get messages in a time window (for dynamic report generation)
   * Routes to KV or D1 based on time range
   */
  getMessagesInTimeWindow(
    channelId: string, 
    windowStart: Date, 
    windowEnd: Date
  ): Promise<EssentialDiscordMessage[]>;

  /**
   * Get messages for report reconstruction (backward compatibility)
   */
  getMessagesForReport(channelId: string, messageIds: string[]): Promise<EssentialDiscordMessage[]>;

  /**
   * Get cached messages since a specific date
   */
  getCachedMessagesSince(channelId: string, since: Date): Promise<EssentialDiscordMessage[]>;

  /**
   * Get all cached messages for a channel
   */
  getAllCachedMessagesForChannel(channelId: string): Promise<EssentialDiscordMessage[]>;

  /**
   * Cache recent messages in KV (maintains existing caching logic)
   */
  cacheMessages(channelId: string, messages: EssentialDiscordMessage[], channelName?: string): Promise<void>;

  /**
   * Update messages (fetches from Discord API and updates both KV and D1)
   */
  updateMessages(local?: boolean): Promise<void>;

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): Promise<CacheStats>;

  /**
   * Clear KV cache for a specific channel
   */
  clearCache(channelId: string): Promise<void>;
}

/**
 * Messages Migration Service Interface
 * Handles the migration process from KV to D1 with validation and rollback capabilities
 */
export interface IMessagesMigrationService {
  /**
   * Perform a dry run to estimate migration impact
   */
  dryRun(channelId: string): Promise<MigrationDryRunResult>;

  /**
   * Migrate a single channel from KV to D1
   */
  migrateChannel(channelId: string, config?: MigrationBatchConfig): Promise<MigrationResult>;

  /**
   * Migrate all channels from KV to D1
   */
  migrateAllChannels(config?: MigrationBatchConfig): Promise<MigrationResult[]>;

  /**
   * Validate migration results for a channel
   */
  validateMigration(channelId: string): Promise<MigrationValidationResult>;

  /**
   * Rollback migration for a channel (restore KV-only mode)
   */
  rollback(channelId: string): Promise<boolean>;

  /**
   * Get migration status for all channels
   */
  getMigrationStatus(): Promise<{
    totalChannels: number;
    migratedChannels: string[];
    pendingChannels: string[];
    failedChannels: string[];
  }>;

  /**
   * Clean up KV cache after successful migration
   */
  cleanupKVCache(channelId: string): Promise<void>;
}

/**
 * Message Transformer Interface
 * Handles conversion between full Discord messages and essential format
 */
export interface IMessageTransformer {
  /**
   * Transform a full Discord message to essential format
   */
  transformToEssential(message: any, channelId: string): EssentialDiscordMessage;

  /**
   * Transform essential message back to display format (for backward compatibility)
   */
  transformToDisplay(essential: EssentialDiscordMessage): any;

  /**
   * Validate that a transformed message contains all required properties
   */
  validateTransformation(essential: EssentialDiscordMessage): boolean;

  /**
   * Calculate storage reduction from transformation
   */
  calculateStorageReduction(original: any, transformed: EssentialDiscordMessage): number;
}