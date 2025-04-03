import { getChannels } from '@/lib/data/channels-service';
import { ReportsService } from '@/lib/data/reports-service';
import { DiscordChannel, Report } from '@/lib/types/core';
import { getCacheContext } from '@/lib/utils';
import ChannelDetailClient from './ChannelDetailClient';

export async function generateMetadata() {
    return {
        title: `Channel Details - News AI World`,
        description: 'View reports for this channel',
    };
}

export default async function ChannelDetailPage({ params }: { params: Promise<{ channelId: string }> }) {
    const { channelId } = await params;
    const { env } = getCacheContext();
    const reportsService = new ReportsService(env);

    const channels: DiscordChannel[] = await getChannels(env);
    const currentChannel = channels.find((c) => c.id === channelId) || null;

    // Fetch reports
    const reports: Report[] = await reportsService.getAllReportsForChannelFromCache(channelId) || [];

    return <ChannelDetailClient reports={reports} channel={currentChannel} />;
}