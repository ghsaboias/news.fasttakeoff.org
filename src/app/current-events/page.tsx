import { getChannels } from "@/lib/data/discord-channels";
import CurrentEventsClient from "./CurrentEventsClient";

// Force dynamic rendering to fetch at runtime
export const dynamic = "force-dynamic";

async function getInitialChannels() {
    console.log('[Server] Fetching initial channels');
    const channels = await getChannels();
    console.log('[Server] Initial channels fetched:', channels.length);
    return channels;
}

export default async function CurrentEventsPage() {
    const initialChannels = await getInitialChannels();
    return <CurrentEventsClient initialChannels={initialChannels} />;
}