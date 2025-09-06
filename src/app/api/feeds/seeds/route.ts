import { withErrorHandling } from '@/lib/api-utils';
import { listActiveWorldSeeds, listInactiveTrackedFeeds } from '@/lib/data/feeds/seed-registry';

export async function GET() {
  return withErrorHandling(async () => {
    return {
      active: listActiveWorldSeeds(),
      tracked: listInactiveTrackedFeeds(),
    };
  }, 'Failed to load world-news feed seeds');
}

