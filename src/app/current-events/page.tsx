import { getChannels } from "@/lib/data/discord-channels";
import CurrentEventsClient from "./CurrentEventsClient";

export const revalidate = 3600;

async function getInitialChannels() {
    console.log('[Server] DISCORD_GUILD_ID:', process.env.DISCORD_GUILD_ID || 'undefined');
    console.log('[Server] DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'set' : 'undefined');
    console.log('[Server] Fetching initial channels');
    try {
        const channels = await getChannels();
        console.log('[Server] Initial channels fetched:', channels.length);
        return channels;
    } catch (error) {
        console.error('[Server] Error fetching channels:', error instanceof Error ? error.message : error);
        return []; // Fallback to empty array to prevent build failure
    }
}

export default async function CurrentEventsPage() {
    const initialChannels = await getInitialChannels();
    return <CurrentEventsClient initialChannels={initialChannels} />;
}