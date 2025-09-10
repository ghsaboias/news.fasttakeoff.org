import { withErrorHandling } from '@/lib/api-utils';
import { ServiceFactory } from '@/lib/services/ServiceFactory';
import { NextResponse } from 'next/server';

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

        const factory = ServiceFactory.getInstance(env);
        const channelsService = factory.createChannelsService();
        const channel = await channelsService.getChannelDetails(channelId);
        return NextResponse.json(channel, {
            headers: {
                'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300',
            },
        });
    }, 'Failed to fetch messages');
}