// src/app/current-events/page.tsx
import { getChannels } from '@/lib/data/discord-channels';
import { unstable_cache } from 'next/cache';
import CurrentEventsClient from './CurrentEventsClient';

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

export const dynamic = 'force-dynamic'; // Force runtime execution
export const revalidate = 3600; // 1 hour

export default async function CurrentEventsPage() {
    console.log('[Server] Starting channel fetch');
    let channels = await getChannels(); // Build-time fetch (returns [])
    console.log('[Server] Initial channels:', channels.length);

    // Force fetch at runtime if empty
    if (channels.length === 0) {
        console.log('[Server] Empty channels, forcing runtime fetch');
        channels = await getCachedChannels();
    } else {
        console.log('[Server] Using initial data:', channels.length);
    }

    return <CurrentEventsClient channels={channels} />;
}