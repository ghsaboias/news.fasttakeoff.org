import { ReportsService } from '@/lib/data/reports-service';
import { DiscordChannel, Report } from '@/lib/types/core';
import { getCacheContext } from '@/lib/utils';
import ChannelDetailClient from './ChannelDetailClient';

export async function generateMetadata({ params }: { params: { channelId: string } }) {
    return {
        title: `Channel Details - News AI World`,
        description: 'View reports for this channel',
    };
}

export default async function ChannelDetailPage({ params }: { params: { channelId: string } }) {
    const { env } = getCacheContext();
    const reportsService = new ReportsService(env);

    // Fetch channels
    const channelsResponse = await fetch('/api/channels', { cache: 'no-store' });
    const channels: DiscordChannel[] = await channelsResponse.json();
    const currentChannel = channels.find((c) => c.id === params.channelId) || null;

    // Fetch reports
    const reports: Report[] = await reportsService.getAllReportsForChannelFromCache(params.channelId) || [];

    return <ChannelDetailClient initialReports={reports} initialChannel={currentChannel} />;
}