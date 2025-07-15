import { withErrorHandling } from '@/lib/api-utils';
import { getFeedItems } from '@/lib/data/rss-service';

/**
 * GET /api/rss/[feedId]
 * Fetches items from a specific RSS feed.
 * @param request - Path param: feedId (string, required)
 * @returns {Promise<NextResponse<FeedItem[] | { error: string }>>}
 * @throws 400 if feedId is missing, 500 for fetch errors.
 * @auth None required.
 * @integration Uses getFeedItems from rss-service.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ feedId: string }> }
) {
    const { feedId } = await params;
    if (!feedId) {
        return new Response('Missing feedId', { status: 400 });
    }
    return withErrorHandling(
        async () => {
            // Fetch and return feed items
            const items = await getFeedItems(feedId);
            return items;
        },
        `Failed to fetch RSS feed items for ${feedId}`
    );
} 