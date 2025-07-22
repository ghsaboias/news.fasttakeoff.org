import { withErrorHandling } from '@/lib/api-utils';
import { MktNewsService } from '@/lib/data/mktnews-service';

/**
 * GET /api/mktnews
 * Fetches MktNews data with optional timeframe filtering
 * @param request - Query params: hours (optional, defaults to 2)
 * @returns {Promise<NextResponse<{ messages: MktNewsMessage[], stats: object } | { error: string }>>}
 * @throws 500 for server errors.
 * @auth None required.
 */
export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const { searchParams } = new URL(request.url);
        const hoursParam = searchParams.get('hours');
        const hours = hoursParam ? parseInt(hoursParam, 10) : 2;

        // Validate hours parameter
        if (isNaN(hours) || hours < 0 || hours > 24) {
            throw new Error('Invalid hours parameter. Must be between 0 and 24.');
        }

        const mktNewsService = new MktNewsService(env);

        const [messages, stats] = await Promise.all([
            mktNewsService.getMessagesForTimeframe(hours),
            mktNewsService.getStats()
        ]);

        return {
            messages,
            stats,
            timeframe: `${hours}h`,
            count: messages.length
        };
    }, 'Failed to fetch MktNews data');
} 