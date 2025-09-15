/**
 * Single Channel Migrator
 * Test migration of one channel from KV to D1
 * 
 * Safe, step-by-step approach to validate transformation and migration logic
 */

import { MessageTransformer } from './message-transformer';
import { D1MessagesService } from '../data/d1-messages-service';
import { migrationLogger } from './migration-logger';
import type { CachedMessages } from '@/lib/types/reports';
import type { Cloudflare } from '../../../worker-configuration';

export interface SingleChannelMigrationResult {
  success: boolean;
  channelId: string;
  channelName: string;
  messagesProcessed: number;
  messagesSuccessful: number;
  messagesFailed: number;
  errors: string[];
  propertiesReduced: number;
  duration: number;
}

export class SingleChannelMigrator {
  private transformer: MessageTransformer;
  private d1Service: D1MessagesService;
  private env: Cloudflare.Env;

  constructor(env: Cloudflare.Env) {
    this.env = env;
    this.transformer = new MessageTransformer();
    this.d1Service = new D1MessagesService(env);
  }

  /**
   * Fetch messages from local KV (assumes data was already copied from production)
   */
  private async fetchFromKV(channelId: string): Promise<CachedMessages> {
    const kvKey = `messages:${channelId}`;
    
    try {
      const cachedData = await this.env.MESSAGES_CACHE.get(kvKey, 'json') as CachedMessages;
      
      if (!cachedData) {
        throw new Error(`No data found for channel ${channelId} in local KV. Run: npx wrangler kv key get "messages:${channelId}" --namespace-id b3ca706f58e44201a1f3d362c358cd1c --remote | npx wrangler kv key put "messages:${channelId}" --namespace-id a51ee099a3cb42eca2e143005e0b2558`);
      }
      
      return cachedData;
    } catch (error) {
      throw new Error(`Failed to fetch from KV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Migrate a single channel from KV to D1
   * Test function for validating migration logic
   */
  async migrateChannel(channelId: string): Promise<SingleChannelMigrationResult> {
    const startTime = Date.now();
    
    migrationLogger.info(`Starting single channel migration`, { channelId });

    try {
      // 1. Fetch messages from KV (assumes production data was copied locally)
      const cachedData = await this.fetchFromKV(channelId);
      
      if (!cachedData) {
        throw new Error(`No data found for channel ${channelId}`);
      }

      migrationLogger.info(`Found ${cachedData.messageCount} messages in KV`, {
        channelId,
        channelName: cachedData.channelName,
        messageCount: cachedData.messageCount
      });

      // 2. Transform and insert each message
      const result: SingleChannelMigrationResult = {
        success: false,
        channelId,
        channelName: cachedData.channelName || 'Unknown',
        messagesProcessed: 0,
        messagesSuccessful: 0,
        messagesFailed: 0,
        errors: [],
        propertiesReduced: 0,
        duration: 0
      };

      for (const discordMessage of cachedData.messages) {
        result.messagesProcessed++;

        try {
          // Transform message
          const transformResult = this.transformer.transform(discordMessage);
          
          if (!transformResult.success || !transformResult.transformed) {
            result.messagesFailed++;
            result.errors.push(`Transform failed for ${discordMessage.id}: ${transformResult.error}`);
            continue;
          }

          // Track properties reduction
          if (transformResult.propertiesReduced) {
            result.propertiesReduced += transformResult.propertiesReduced;
          }

          // Insert into D1
          await this.d1Service.createMessage(transformResult.transformed);
          result.messagesSuccessful++;

          migrationLogger.debug(`Migrated message ${discordMessage.id}`, {
            channelId,
            messageId: discordMessage.id,
            propertiesReduced: transformResult.propertiesReduced
          });

        } catch (error) {
          result.messagesFailed++;
          const errorMsg = `Failed to migrate message ${discordMessage.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          migrationLogger.error(errorMsg, { channelId, messageId: discordMessage.id }, error as Error);
        }
      }

      // 3. Validation - compare counts
      const d1Count = await this.d1Service.getMessageCount(channelId);
      if (d1Count !== result.messagesSuccessful) {
        throw new Error(`Count mismatch: Expected ${result.messagesSuccessful}, got ${d1Count} in D1`);
      }

      result.duration = Date.now() - startTime;
      result.success = result.messagesFailed === 0;

      migrationLogger.info(`Migration completed`, {
        channelId,
        success: result.success,
        processed: result.messagesProcessed,
        successful: result.messagesSuccessful,
        failed: result.messagesFailed,
        propertiesReduced: result.propertiesReduced,
        duration: result.duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown migration error';
      
      migrationLogger.error(`Migration failed for channel ${channelId}`, { channelId, duration }, error as Error);
      
      return {
        success: false,
        channelId,
        channelName: 'Unknown',
        messagesProcessed: 0,
        messagesSuccessful: 0,
        messagesFailed: 0,
        errors: [errorMsg],
        propertiesReduced: 0,
        duration
      };
    }
  }

  /**
   * Dry run - analyze what would be migrated without making changes
   */
  async dryRun(channelId: string): Promise<{
    channelId: string;
    channelName: string;
    messageCount: number;
    sampleTransform: unknown;
    estimatedPropertiesReduced: number;
  }> {
    migrationLogger.info(`Starting dry run for channel ${channelId}`);

    const kvKey = `messages:${channelId}`;
    const cachedData = await this.env.MESSAGES_CACHE.get(kvKey, 'json') as CachedMessages;
    
    if (!cachedData) {
      throw new Error(`No data found for channel ${channelId}`);
    }

    // Test transform on first message
    const sampleMessage = cachedData.messages[0];
    const transformResult = this.transformer.transform(sampleMessage);
    
    return {
      channelId,
      channelName: cachedData.channelName || 'Unknown',
      messageCount: cachedData.messageCount,
      sampleTransform: transformResult,
      estimatedPropertiesReduced: (transformResult.propertiesReduced || 0) * cachedData.messageCount
    };
  }

  /**
   * Validate migration by comparing sample data
   */
  async validateMigration(channelId: string, sampleSize: number = 3): Promise<{
    success: boolean;
    kvCount: number;
    d1Count: number;
    sampleMatches: number;
    sampleChecked: number;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Get counts
      const kvKey = `messages:${channelId}`;
      const cachedData = await this.env.MESSAGES_CACHE.get(kvKey, 'json') as CachedMessages;
      const d1Count = await this.d1Service.getMessageCount(channelId);

      if (!cachedData) {
        errors.push('KV data not found');
        return { success: false, kvCount: 0, d1Count, sampleMatches: 0, sampleChecked: 0, errors };
      }

      // Count validation
      if (cachedData.messageCount !== d1Count) {
        errors.push(`Count mismatch: KV=${cachedData.messageCount}, D1=${d1Count}`);
      }

      // Sample validation
      const samplesToCheck = Math.min(sampleSize, cachedData.messages.length);
      let sampleMatches = 0;

      for (let i = 0; i < samplesToCheck; i++) {
        const kvMessage = cachedData.messages[i];
        const d1Messages = await this.d1Service.getMessagesByIds([kvMessage.id]);
        
        if (d1Messages.length === 1) {
          const d1Message = d1Messages[0];
          if (d1Message.id === kvMessage.id && d1Message.content === kvMessage.content) {
            sampleMatches++;
          } else {
            errors.push(`Sample mismatch for message ${kvMessage.id}`);
          }
        } else {
          errors.push(`Message ${kvMessage.id} not found in D1 or duplicate`);
        }
      }

      return {
        success: errors.length === 0,
        kvCount: cachedData.messageCount,
        d1Count,
        sampleMatches,
        sampleChecked: samplesToCheck,
        errors
      };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, kvCount: 0, d1Count: 0, sampleMatches: 0, sampleChecked: 0, errors };
    }
  }
}