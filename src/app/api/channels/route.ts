import { withErrorHandling } from '@/lib/api-utils';
import { ServiceFactory } from '@/lib/services/ServiceFactory';
import { NextResponse } from 'next/server';

/**
 * GET /api/channels
 * Fetches a list of Discord channels with metadata.
 * @returns {Promise<NextResponse<DiscordChannel[]>>} - Array of channel objects.
 * @throws 500 if there is an error fetching channels.
 * @auth None required.
 */
export async function GET() {
    return withErrorHandling(
        async (env) => {
            const factory = ServiceFactory.getInstance(env);
            const channelsService = factory.createChannelsService();
            const channels = await channelsService.getChannels();
            return NextResponse.json(channels, {
                headers: {
                    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
                },
            });
        },
        'Failed to fetch channels'
    );
}