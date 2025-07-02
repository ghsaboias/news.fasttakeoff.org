import { withErrorHandling } from '@/lib/api-utils';
import { EnhancedMessagesService } from '@/lib/data/enhanced-messages-service';

export async function GET(request: Request) {
    return withErrorHandling(async (env) => {
        const { searchParams } = new URL(request.url);
        const channelId = searchParams.get('channelId');
        const filterMode = searchParams.get('filterMode') as 'news' | 'politics' | 'technology' | 'finance' || 'news';
        const enableFiltering = searchParams.get('enableFiltering') !== 'false';
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
        const since = searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined;

        if (!channelId) {
            return new Response(JSON.stringify({ error: 'channelId parameter is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const messagesService = new EnhancedMessagesService(env);
        
        const result = await messagesService.getFilteredMessages(channelId, {
            filterMode,
            enableFiltering,
            limit,
            since
        });

        return {
            channelId,
            filterMode,
            enableFiltering,
            result: {
                messages: result.messages,
                source: result.source,
                metadata: result.metadata,
                filterStats: result.filterResult?.filterStats
            }
        };
    }, 'Failed to fetch filtered messages');
}

export async function POST(request: Request) {
    return withErrorHandling(async (env) => {
        const body = await request.json();
        const { channelIds, filterMode = 'news', enableFiltering = true, limit, since } = body;

        if (!channelIds || !Array.isArray(channelIds)) {
            return new Response(JSON.stringify({ error: 'channelIds array is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const messagesService = new EnhancedMessagesService(env);
        
        const results = await messagesService.getFilteredMessagesForChannels(channelIds, {
            filterMode,
            enableFiltering,
            limit,
            since: since ? new Date(since) : undefined
        });

        // Convert Map to object for JSON serialization
        const resultsObject: Record<string, {
            messages: unknown[];
            source: string;
            metadata: unknown;
            filterStats?: unknown;
        }> = {};
        for (const [channelId, result] of results.entries()) {
            resultsObject[channelId] = {
                messages: result.messages,
                source: result.source,
                metadata: result.metadata,
                filterStats: result.filterResult?.filterStats
            };
        }

        return {
            filterMode,
            enableFiltering,
            channelCount: channelIds.length,
            results: resultsObject
        };
    }, 'Failed to fetch filtered messages for multiple channels');
}