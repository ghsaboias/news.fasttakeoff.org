import { withErrorHandling } from '@/lib/api-utils';
import { FeedsService } from '@/lib/data/feeds-service';

/**
 * GET /api/summaries/[key]
 * Fetches a cached news summary for a specific key.
 * @param request - Path param: key (string, required)
 * @returns {Promise<NextResponse<SummaryResult | { error: string }>>}
 * @throws 400 if key is missing, 404 if summary not found, 500 for errors.
 * @auth None required.
 * @integration Uses FeedsService.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ key: string }> }
) {
    const { key } = await params;

    if (!key) {
        return new Response('Missing key parameter', { status: 400 });
    }

    return withErrorHandling(
        async (env) => {
            const feedsService = new FeedsService(env);
            const summary = await feedsService.getSummaryByKey(key);

            if (!summary) {
                throw new Error('Summary not found');
            }

            return summary;
        },
        `Failed to get summary for key ${key}`
    );
} 