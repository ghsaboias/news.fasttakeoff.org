// src/app/current-events/page.tsx
import { getChannels } from "@/lib/data/discord-channels";
import CurrentEventsClient from "./CurrentEventsClient";

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