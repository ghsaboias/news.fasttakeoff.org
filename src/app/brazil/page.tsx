import { FeedsService } from '@/lib/data/feeds-service';
import { SummaryResult } from '@/lib/types/feeds';
import { getCacheContext } from '@/lib/utils';
import SummaryDisplay from './SummaryDisplay';

// Force dynamic rendering to ensure Cloudflare bindings are available
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
    return {
        title: 'Brazil - Fast Takeoff News',
        description: 'Latest news and updates from Brazil.',
        alternates: {
            canonical: 'https://news.fasttakeoff.org/brazil'
        }
    };
}

export default async function BrazilPage() {
    const { env } = await getCacheContext();

    let initialSummary: SummaryResult | null = null;

    // Fetch default summary (geral topic) server-side for SEO
    if (env) {
        try {
            const feedsService = new FeedsService(env);
            initialSummary = await feedsService.getOrCreateSummary('geral');
        } catch (error) {
            console.error('[Brazil Page] Failed to fetch initial summary:', error);
            // Continue without initial data - client will fetch
        }
    }

    return (
        <div className="px-4 flex flex-col items-center w-[90vw]">
            <SummaryDisplay initialSummary={initialSummary} />
        </div>
    );
} 