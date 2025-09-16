import { getCacheContext } from '@/lib/utils';


export async function GET() {
  try {
    const { env } = await getCacheContext();

    const cronTypes = ['FEEDS_GERAL', 'FEEDS_MERCADO', 'SOCIAL_MEDIA_POST', 'EXECUTIVE_SUMMARY_6H', 'MESSAGES', 'WINDOW_EVALUATION', 'MKTNEWS_SUMMARY', 'MKTNEWS'];

    // Get aggregated statuses from KV cache
    let statuses = [];
    try {
      const aggregatedRaw = await env.CRON_STATUS_CACHE.get('cron_statuses_aggregated');

      if (aggregatedRaw && typeof aggregatedRaw === 'string') {
        const aggregatedStatuses = JSON.parse(aggregatedRaw);

        // Convert aggregated data to array format expected by frontend
        statuses = cronTypes.map(cronType => {
          const status = aggregatedStatuses[cronType];
          if (status) {
            return { type: cronType, ...status };
          } else {
            return {
              type: cronType,
              outcome: 'unknown',
              timestamp: 'Never run',
              duration: 0,
              errorCount: 0
            };
          }
        });
      } else {
        // No aggregated data exists, return defaults
        statuses = cronTypes.map(cronType => ({
          type: cronType,
          outcome: 'unknown',
          timestamp: 'Never run',
          duration: 0,
          errorCount: 0
        }));
      }
    } catch (error) {
      console.warn('[CRON-STATUS] Failed to fetch from KV:', error);
      // Return defaults on error
      statuses = cronTypes.map(cronType => ({
        type: cronType,
        outcome: 'unknown',
        timestamp: 'Never run',
        duration: 0,
        errorCount: 0
      }));
    }

    return Response.json(statuses);
  } catch (error) {
    console.error('[CRON-STATUS] Failed to get cron status:', error);
    return Response.json({ error: 'Failed to fetch cron status' }, { status: 500 });
  }
}