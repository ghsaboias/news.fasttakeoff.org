// src/app/current-events/page.tsx
import { getChannels } from '@/lib/data/discord-channels';
import { unstable_cache } from 'next/cache';
import CurrentEventsClient from './CurrentEventsClient';

// Cache with 1-hour revalidation
const getCachedChannels = unstable_cache(
    async () => {
        console.log('[Server] Fetching channels from Discord');
        const channels = await getChannels();
        console.log('[Server] Channels fetched:', channels.length);
        return channels;
    },
    ['discord-channels'],
    { revalidate: 3600, tags: ['discord-channels'] }
);

export const revalidate = 3600; // 1 hour

export default async function CurrentEventsPage() {
    console.log('[Server] Starting channel fetch');
    let channels = await getChannels(); // Build-time fetch (returns [] due to skip)

    // If channels is empty, fetch fresh data at runtime
    if (channels.length === 0 && process.env.NEXT_PHASE !== 'phase-production-build') {
        console.log('[Server] Build-time data empty, forcing runtime fetch');
        channels = await getCachedChannels();
    } else {
        console.log('[Server] Using build-time or cached data:', channels.length);
    }

    return <CurrentEventsClient channels={channels} />;
}