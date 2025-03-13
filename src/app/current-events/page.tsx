export const revalidate = 3600; // 1 hour

import { getChannels } from '@/lib/data/discord-channels';
import CurrentEventsClient from './CurrentEventsClient';

export default async function CurrentEventsPage() {
    const channels = await getChannels();
    console.log('[Server] Initial channels fetched:', channels.length);
    return <CurrentEventsClient channels={channels} />;
}