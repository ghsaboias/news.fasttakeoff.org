import { getChannels } from '@/lib/data/discord-channels';
import CurrentEventsClient from './CurrentEventsClient';

// ISR: Revalidate every hour
export const revalidate = 3600;

export default async function CurrentEventsPage() {
    console.log('[Build] Fetching channels for /current-events');
    const channels = await getChannels(); // No env param here
    console.log('[Build] Channels fetched:', channels.length);

    return <CurrentEventsClient channels={channels} />;
}