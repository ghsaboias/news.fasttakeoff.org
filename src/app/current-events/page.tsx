import { getChannels } from "@/lib/data/discord-channels";
import CurrentEventsClient from "./CurrentEventsClient";

// Use ISR with a 1-hour revalidation period
export const revalidate = 3600; // 1 hour in seconds

async function getInitialChannels() {
    console.log('[Server] DISCORD_GUILD_ID:', process.env.DISCORD_GUILD_ID || 'undefined');
    console.log('[Server] DISCORD_TOKEN:', process.env.DISCORD_TOKEN || 'undefined');
    console.log('[Server] Fetching initial channels');
    try {
        const channels = await getChannels();
        console.log('[Server] Initial channels fetched:', channels.length);
        return channels;
    } catch (error) {
        console.error('[Server] Error fetching channels:', error instanceof Error ? error.message : error);
        throw error;
    }
}

export default async function CurrentEventsPage() {
    const initialChannels = await getInitialChannels();
    return <CurrentEventsClient initialChannels={initialChannels} />;
}