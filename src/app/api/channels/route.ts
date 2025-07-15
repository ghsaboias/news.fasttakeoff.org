import { withErrorHandling } from '@/lib/api-utils';
import { getChannels } from '@/lib/data/channels-service';

/**
 * GET /api/channels
 * Fetches a list of Discord channels with metadata.
 * @returns {Promise<NextResponse<DiscordChannel[]>>} - Array of channel objects.
 * @throws 500 if there is an error fetching channels.
 * @auth None required.
 */
export async function GET() {
    return withErrorHandling(
        env => getChannels(env),
        'Failed to fetch channels'
    );
}