import { withErrorHandling } from '@/lib/api-utils';
import { getFeedItems } from '@/lib/data/rss-service';

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