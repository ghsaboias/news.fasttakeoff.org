import { AI } from '@/lib/config';
import { DiscordMessage } from '@/lib/types/core';
import { MessageFilter, MessageFilterResult } from '@/lib/utils/message-filter';
import { Cloudflare } from '../../../worker-configuration';
import { MessagesService } from './messages-service';

export interface FilteredMessageOptions {
    since?: Date;
    limit?: number;
    enableFiltering?: boolean;
    filterMode?: 'news' | 'politics' | 'technology' | 'finance';
    customPrompt?: string;
    cacheFiltered?: boolean;
}

export interface EnhancedMessageResult {
    messages: DiscordMessage[];
    filterResult?: MessageFilterResult;
    source: 'cache' | 'api' | 'filtered';
    metadata: {
        totalFetched: number;
        totalRelevant: number;
        filteringEnabled: boolean;
        processingTimeMs: number;
    };
}

/**
 * Enhanced messages service that adds AI-powered message filtering capabilities
 * on top of the existing MessagesService
 */
export class EnhancedMessagesService extends MessagesService {
    
    constructor(env: Cloudflare.Env) {
        super(env);
    }

    /**
     * Gets messages with optional AI-powered filtering
     */
    async getFilteredMessages(
        channelId: string, 
        options: FilteredMessageOptions = {}
    ): Promise<EnhancedMessageResult> {
        const startTime = Date.now();
        const { 
            since, 
            limit, 
            enableFiltering = AI.MESSAGE_FILTERING.ENABLED,
            filterMode = 'news',
            customPrompt,
            cacheFiltered = true
        } = options;

        // First, get messages using the parent class
        const allMessages = await super.getMessages(channelId, { since, limit });
        
        if (!enableFiltering || allMessages.length === 0) {
            // Return unfiltered messages
            return {
                messages: allMessages,
                source: 'cache',
                metadata: {
                    totalFetched: allMessages.length,
                    totalRelevant: allMessages.length,
                    filteringEnabled: false,
                    processingTimeMs: Date.now() - startTime
                }
            };
        }

        try {
            // Check if we have cached filter results
            const cacheKey = this.getFilterCacheKey(channelId, filterMode, allMessages.length);
            let filterResult: MessageFilterResult | null = null;

            if (cacheFiltered) {
                filterResult = await this.getCachedFilterResult(cacheKey);
            }

            if (!filterResult) {
                // Apply AI filtering
                console.log(`[ENHANCED_MESSAGES] Applying ${filterMode} filtering to ${allMessages.length} messages for channel ${channelId}`);
                
                const prompt = customPrompt || MessageFilter.getFilterPromptForUseCase(filterMode);
                filterResult = await MessageFilter.filterMessages(allMessages, this.env, prompt);

                // Cache the filter result if enabled
                if (cacheFiltered) {
                    await this.cacheFilterResult(cacheKey, filterResult);
                }
            } else {
                console.log(`[ENHANCED_MESSAGES] Using cached filter result for channel ${channelId}`);
            }

            const finalMessages = limit ? filterResult.relevantMessages.slice(0, limit) : filterResult.relevantMessages;

            return {
                messages: finalMessages,
                filterResult,
                source: 'filtered',
                metadata: {
                    totalFetched: allMessages.length,
                    totalRelevant: filterResult.relevantMessages.length,
                    filteringEnabled: true,
                    processingTimeMs: Date.now() - startTime
                }
            };

        } catch (error) {
            console.error(`[ENHANCED_MESSAGES] Filtering failed for channel ${channelId}:`, error);
            
            // Fallback to unfiltered messages on error
            return {
                messages: allMessages,
                source: 'api',
                metadata: {
                    totalFetched: allMessages.length,
                    totalRelevant: allMessages.length,
                    filteringEnabled: false,
                    processingTimeMs: Date.now() - startTime
                }
            };
        }
    }

    /**
     * Batch processes multiple channels with filtering
     */
    async getFilteredMessagesForChannels(
        channelIds: string[],
        options: FilteredMessageOptions = {}
    ): Promise<Map<string, EnhancedMessageResult>> {
        const results = new Map<string, EnhancedMessageResult>();
        
        console.log(`[ENHANCED_MESSAGES] Processing ${channelIds.length} channels with filtering`);

        // Process channels sequentially to avoid overwhelming the AI API
        for (const channelId of channelIds) {
            try {
                const result = await this.getFilteredMessages(channelId, options);
                results.set(channelId, result);
                
                // Add delay between channels to be respectful to AI API
                if (channelIds.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, AI.MESSAGE_FILTERING.BATCH_DELAY_MS));
                }
            } catch (error) {
                console.error(`[ENHANCED_MESSAGES] Failed to process channel ${channelId}:`, error);
                // Continue with other channels
            }
        }

        return results;
    }

    /**
     * Gets relevance statistics for a channel
     */
    async getChannelRelevanceStats(
        channelId: string,
        options: { since?: Date; filterMode?: 'news' | 'politics' | 'technology' | 'finance' } = {}
    ): Promise<{
        totalMessages: number;
        relevantMessages: number;
        filteredMessages: number;
        relevanceRate: number;
        lastAnalyzed: string;
    }> {
        const result = await this.getFilteredMessages(channelId, {
            ...options,
            enableFiltering: true
        });

        const stats = result.filterResult?.filterStats || {
            totalProcessed: result.messages.length,
            totalRelevant: result.messages.length,
            totalFiltered: 0
        };

        return {
            totalMessages: stats.totalProcessed,
            relevantMessages: stats.totalRelevant,
            filteredMessages: stats.totalFiltered,
            relevanceRate: stats.totalProcessed > 0 ? stats.totalRelevant / stats.totalProcessed : 1,
            lastAnalyzed: new Date().toISOString()
        };
    }

    /**
     * Re-analyzes messages with a different filter mode
     */
    async reanalyzeMessages(
        channelId: string,
        newFilterMode: 'news' | 'politics' | 'technology' | 'finance',
        options: { since?: Date; limit?: number } = {}
    ): Promise<{
        previous: EnhancedMessageResult;
        reanalyzed: EnhancedMessageResult;
        comparison: {
            previousRelevant: number;
            newRelevant: number;
            differencePercent: number;
        };
    }> {
        // Get current filtered result
        const previous = await this.getFilteredMessages(channelId, {
            ...options,
            enableFiltering: true,
            filterMode: 'news' // Default comparison baseline
        });

        // Get reanalyzed result with new filter mode
        const reanalyzed = await this.getFilteredMessages(channelId, {
            ...options,
            enableFiltering: true,
            filterMode: newFilterMode,
            cacheFiltered: false // Force fresh analysis
        });

        const previousRelevant = previous.filterResult?.filterStats.totalRelevant || previous.messages.length;
        const newRelevant = reanalyzed.filterResult?.filterStats.totalRelevant || reanalyzed.messages.length;
        const differencePercent = previousRelevant > 0 
            ? ((newRelevant - previousRelevant) / previousRelevant) * 100 
            : 0;

        return {
            previous,
            reanalyzed,
            comparison: {
                previousRelevant,
                newRelevant,
                differencePercent
            }
        };
    }

    /**
     * Cache management for filter results
     */
    private getFilterCacheKey(channelId: string, filterMode: string, messageCount: number): string {
        return `filter:${channelId}:${filterMode}:${messageCount}`;
    }

    private async getCachedFilterResult(cacheKey: string): Promise<MessageFilterResult | null> {
        try {
            const cached = await this.cacheManager.get<MessageFilterResult>('MESSAGES_CACHE', cacheKey);
            return cached;
        } catch (error) {
            console.warn(`[ENHANCED_MESSAGES] Failed to get cached filter result:`, error);
            return null;
        }
    }

    private async cacheFilterResult(cacheKey: string, result: MessageFilterResult): Promise<void> {
        try {
            await this.cacheManager.put(
                'MESSAGES_CACHE', 
                cacheKey, 
                result, 
                AI.MESSAGE_FILTERING.CACHE_TTL
            );
        } catch (error) {
            console.warn(`[ENHANCED_MESSAGES] Failed to cache filter result:`, error);
            // Non-fatal error, continue without caching
        }
    }

    /**
     * Gets filter performance metrics across all channels
     */
    async getFilterPerformanceMetrics(): Promise<{
        channelsAnalyzed: number;
        totalMessages: number;
        totalRelevant: number;
        averageRelevanceRate: number;
        totalProcessingTime: number;
        averageBatchTime: number;
    }> {
        // This would typically read from a metrics store
        // For now, we'll return a placeholder structure
        return {
            channelsAnalyzed: 0,
            totalMessages: 0,
            totalRelevant: 0,
            averageRelevanceRate: 0,
            totalProcessingTime: 0,
            averageBatchTime: 0
        };
    }

    /**
     * Validates filter configuration and connectivity
     */
    async validateFilterSetup(): Promise<{
        aiConfigValid: boolean;
        apiKeyPresent: boolean;
        modelAccessible: boolean;
        error?: string;
    }> {
        try {
            // Test with a minimal message to validate the filter setup
            const testMessage: DiscordMessage = {
                id: 'test-message',
                content: 'Breaking: Test message for filter validation',
                timestamp: new Date().toISOString(),
                author: {
                    username: 'TestUser',
                    discriminator: '0000',
                    avatar: '',
                    global_name: 'Test User',
                    id: 'test-user-id'
                }
            };

            const testResult = await MessageFilter.filterMessages([testMessage], this.env);
            
            return {
                aiConfigValid: true,
                apiKeyPresent: true,
                modelAccessible: testResult.relevantMessages.length > 0,
            };
        } catch (error) {
            return {
                aiConfigValid: false,
                apiKeyPresent: false,
                modelAccessible: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}