import { withErrorHandling } from '@/lib/api-utils';
import { RSS_FEEDS } from '@/lib/config';

/**
 * GET /api/rss
 * Lists available RSS feed sources for news aggregation.
 * @returns {Promise<NextResponse<{ id: string; url: string }[]>>}
 * @throws 500 for errors.
 * @auth None required.
 */
export async function GET() {
    return withErrorHandling(
        async () => {
            // Return array of feed definitions
            return Object.entries(RSS_FEEDS).map(([id, url]) => ({ id, url }));
        },
        'Failed to list RSS feeds'
    );
} 