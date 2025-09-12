/**
 * Messages Migration Types
 * 
 * Types specific to the KV-to-D1 migration process, including essential message formats,
 * migration services, and transformation utilities.
 */

import { DiscordMessage } from './discord';

/**
 * Essential Discord Message - Optimized format with only the 26 properties we actually use
 * This represents a 69% storage reduction from the full Discord message format
 */
export interface EssentialDiscordMessage {
  // Core message properties (7)
  id: string;
  content: string;
  timestamp: string; // ISO timestamp
  channel_id: string;
  author_username: string | null;
  author_discriminator: string | null;
  author_global_name: string | null;

  // Context property (1)
  referenced_message_content: string | null;

  // Structured data as JSON (2 properties containing all embed/attachment data)
  embeds: EssentialEmbed[] | null;
  attachments: EssentialAttachment[] | null;
}

/**
 * Essential Embed - Only the properties we actually use for reports and newsletters
 */
export interface EssentialEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  author?: {
    name: string;
    icon_url?: string;
  };
  footer?: {
    text: string;
  };
  thumbnail?: {
    url: string;
    proxy_url?: string;
    width?: number;
    height?: number;
  };
  // NEW: Full-size image support for newsletters (previously missing)
  image?: {
    url: string;
    proxy_url?: string;
    width?: number;
    height?: number;
  };
}

/**
 * Essential Attachment - Only the properties we actually use for newsletter image extraction
 */
export interface EssentialAttachment {
  url: string;
  filename: string;
  content_type: string;
  width?: number;
  height?: number;
}

/**
 * Database row structure for D1 messages table
 */
export interface MessageRow {
  id: number; // Auto-increment primary key
  message_id: string; // Discord message ID (unique)
  channel_id: string;
  content: string;
  timestamp: string; // ISO timestamp
  author_username: string | null;
  author_discriminator: string | null;
  author_global_name: string | null;
  referenced_message_content: string | null;
  embeds: string | null; // JSON string
  attachments: string | null; // JSON string
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
}

/**
 * Result of transforming a full Discord message to essential format
 */
export interface MessageTransformResult {
  essential: EssentialDiscordMessage;
  originalSize: number; // Bytes of original message
  transformedSize: number; // Bytes of essential message
  reductionPercent: number; // Storage reduction percentage
  propertiesFiltered: string[]; // List of properties that were filtered out
}

/**
 * Migration progress tracking
 */
export interface MigrationProgress {
  channelId: string;
  totalMessages: number;
  processedMessages: number;
  successCount: number;
  errorCount: number;
  currentBatch: number;
  estimatedTimeRemaining: number; // milliseconds
  startedAt: number; // Unix timestamp
  errors: MigrationError[];
}

/**
 * Migration error details
 */
export interface MigrationError {
  messageId: string;
  error: string;
  context: string;
  timestamp: number;
}

/**
 * Dry run migration results
 */
export interface MigrationDryRunResult {
  channelId: string;
  messageCount: number;
  estimatedDuration: number; // milliseconds
  storageReduction: number; // percentage (should be ~0.69)
  potentialIssues: string[];
  sampleTransformations: MessageTransformResult[];
}

/**
 * Migration validation results
 */
export interface MigrationValidationResult {
  channelId: string;
  kvCount: number;
  d1Count: number;
  checksumMatch: boolean;
  sampleValidation: {
    sampleSize: number;
    allMatch: boolean;
    mismatches: string[];
  };
  functionalityTest: {
    passed: boolean;
    reportGeneration: boolean;
    newsletterExtraction: boolean;
    timeWindowQueries: boolean;
    errors: string[];
  };
  validatedAt: number;
}

/**
 * Migration batch configuration
 */
export interface MigrationBatchConfig {
  batchSize: number; // Messages per batch (default: 100)
  delayBetweenBatches: number; // Milliseconds (default: 100)
  maxRetries: number; // Per message (default: 3)
  onProgress?: (progress: MigrationProgress) => void;
  onError?: (error: MigrationError) => void;
}

/**
 * Complete migration result
 */
export interface MigrationResult {
  success: boolean;
  channelId: string;
  migratedCount: number;
  failedCount: number;
  duration: number; // milliseconds
  storageReduction: number; // percentage
  errors: MigrationError[];
  validationResult?: MigrationValidationResult;
}

/**
 * KV cache configuration for hybrid approach
 */
export interface KVCacheConfig {
  ttl: number; // Time to live in seconds (default: 12 hours)
  keyPrefix: string; // Key prefix (default: 'messages_recent')
  maxSize: number; // Max messages to cache per channel
  compressionEnabled: boolean; // Whether to compress JSON
}

/**
 * Hybrid service query options
 */
export interface HybridQueryOptions {
  since?: Date; // Filter messages after this date
  until?: Date; // Filter messages before this date
  limit?: number; // Maximum messages to return
  useKVCache?: boolean; // Force KV cache usage
  useD1Only?: boolean; // Force D1-only queries
}

/**
 * Cache hit/miss statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  kvQueries: number;
  d1Queries: number;
  avgResponseTime: number;
  lastUpdated: number;
}