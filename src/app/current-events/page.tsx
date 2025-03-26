import ReportsCarousel from '@/components/current-events/Carousel';
import { getChannels } from '@/lib/data/channels-service';
import { getCacheContext } from '@/lib/utils';
import { unstable_cache } from 'next/cache';
import CurrentEventsClient from './CurrentEventsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function generateMetadata() {
    return {
        title: 'Current Events - News AI World',
        description: 'Latest updates from Discord channels.',
    };
}

const getCachedChannels = unstable_cache(
    async () => {
        console.log('[Runtime] Fetching channels for /current-events');
        const { env } = getCacheContext();
        const channels = await getChannels(env);
        console.log('[Runtime] Channels fetched:', channels.length);
        return channels;
    },
    ['discord-channels'],
    { revalidate: 3600 } // Cache for 1 hour
);

export default async function CurrentEventsPage() {
    const channels = await getCachedChannels();
    return (
        <div className="flex flex-col gap-8">
            <ReportsCarousel />
            <CurrentEventsClient channels={channels} />
        </div>
    );
}