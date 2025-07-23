import { withErrorHandling } from '@/lib/api-utils';
import { MktNewsSummaryService } from '@/lib/data/mktnews-summary-service';

/**
 * GET /api/mktnews/summary
 * Returns the latest 15-minute market summary (Markdown) and optional history.
 * Query params:
 *   history (optional, number) – how many previous summaries to include (default 0)
 *
 * Response:
 * {
 *   summary: MktNewsSummary | null,
 *   history?: MktNewsSummary[]
 * }
 */
export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const { searchParams } = new URL(request.url);
        const historyParam = searchParams.get('history');
        const historyCount = historyParam ? Math.min(Math.max(parseInt(historyParam, 10), 0), 10) : 0;

        const summaryService = new MktNewsSummaryService(env);
        const latest = await summaryService.getLatestSummary();

        let history: Awaited<ReturnType<typeof summaryService.listPreviousSummaries>> | undefined;
        if (historyCount > 0) {
            history = await summaryService.listPreviousSummaries(historyCount);
        }

        return {
            summary: latest,
            history,
        };
    }, 'Failed to fetch market summary');
} 