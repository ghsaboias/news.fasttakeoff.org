import { DiscordClient } from '@/lib/data/discord-channels';
import { generateReport } from '@/lib/data/discord-reports';
import { DiscordChannel, DiscordMessage, Report } from '@/lib/types/core';
import { notFound } from 'next/navigation';
import ChannelDetailClient from './ChannelDetailClient';

// Fetch channel data and report using server-side logic
async function getChannelDetails(channelId: string): Promise<{
    channel: DiscordChannel | null;
    messages: { count: number; messages: DiscordMessage[] };
    report: Report | null;
}> {
    try {
        const discordClient = new DiscordClient();
        const channels = await discordClient.fetchChannels();
        const channel = channels.find(c => c.id === channelId);

        if (!channel) {
            return { channel: null, messages: { count: 0, messages: [] }, report: null };
        }

        // Fetch messages
        const messages = await discordClient.fetchLastHourMessages(channelId);

        // Generate report
        let report = null;
        try {
            report = await generateReport(channelId, false);
        } catch (error) {
            console.error("Error generating report:", error);
        }

        return { channel, messages, report };
    } catch (error) {
        console.error("Error fetching channel details:", error);
        return { channel: null, messages: { count: 0, messages: [] }, report: null };
    }
}

export default async function ChannelDetailPage({ params }: { params: Promise<{ channelId: string }> }) {
    const { channelId } = await params;
    const { channel, messages, report } = await getChannelDetails(channelId);

    if (!channel) {
        notFound(); // Return 404 if channel is not found
    }

    return (
        <ChannelDetailClient
            channel={channel}
            report={report}
            messages={messages}
        />
    );
} 