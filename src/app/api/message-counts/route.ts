import { withErrorHandling } from '@/lib/api-utils';
import { MessageCountsService } from '@/lib/data/message-counts-service';

export async function GET() {
    return withErrorHandling(async (env) => {
        const messageCountsService = new MessageCountsService(env);

        // Get all channel counts
        const allCounts = await messageCountsService.getAllChannelCounts();

        // Get report decisions
        const decisions = await messageCountsService.getReportDecisions();

        return {
            timestamp: new Date().toISOString(),
            totalChannels: allCounts.length,
            channels: allCounts,
            decisions: decisions.filter(d => d.shouldGenerate),
            summary: {
                channelsWithRecentActivity: decisions.filter(d => d.shouldGenerate).length,
                totalMessages5min: allCounts.reduce((sum, c) => sum + c.counts['5min'], 0),
                totalMessages1h: allCounts.reduce((sum, c) => sum + c.counts['1h'], 0),
                totalMessages6h: allCounts.reduce((sum, c) => sum + c.counts['6h'], 0),
            }
        };
    }, 'Failed to fetch message counts');
} 