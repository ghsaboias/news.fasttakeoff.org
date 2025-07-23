import { withErrorHandling } from '@/lib/api-utils';
import { getChannels } from '@/lib/data/channels-service';
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
            const channels = await getChannels(env);
            return NextResponse.json(channels, {
                headers: {
                    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
                },
            });
        },
        'Failed to fetch channels'
    );
}