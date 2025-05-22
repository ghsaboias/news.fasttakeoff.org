import { withErrorHandling } from '@/lib/api-utils';
import { FeedsService } from '@/lib/data/feeds-service';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

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