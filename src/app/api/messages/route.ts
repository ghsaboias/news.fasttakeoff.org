import { withErrorHandling } from '@/lib/api-utils';
import { getChannelDetails } from '@/lib/data/channels-service';

/**
 * GET /api/messages
 * Fetches details and messages for a specific Discord channel.
 * @param request - Query param: channelId (string, required)
 * @returns {Promise<NextResponse<{ channel: DiscordChannel | null; messages: { count: number; messages: DiscordMessage[] } } | { error: string }>>}
 * @throws 400 if channelId is missing, 500 for server errors.
 * @auth None required.
 */
export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const { searchParams } = new URL(request.url);
        const channelId = searchParams.get('channelId');

        if (!channelId) {
            throw new Error('Missing channelId parameter');
        }

        const channel = await getChannelDetails(env, channelId);
        return channel;
    }, 'Failed to fetch messages');
} 