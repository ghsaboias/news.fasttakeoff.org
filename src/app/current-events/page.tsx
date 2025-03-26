import { getChannels } from '@/lib/data/channels-service';
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
        const channels = await getChannels();
        console.log('[Runtime] Channels fetched:', channels.length);
        return channels;
    },
    ['discord-channels'],
    { revalidate: 3600 } // Cache for 1 hour
);

export default async function CurrentEventsPage() {
    const channels = await getCachedChannels();
    return <CurrentEventsClient channels={channels} />;
}