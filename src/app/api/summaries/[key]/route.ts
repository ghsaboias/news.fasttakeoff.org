import { withErrorHandling } from '@/lib/api-utils';
import { FeedsService } from '@/lib/data/feeds-service';

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