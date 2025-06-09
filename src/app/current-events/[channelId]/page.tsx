import { getChannels } from '@/lib/data/channels-service';
import { ReportGeneratorService } from '@/lib/data/report-generator-service';
import { DiscordChannel, Report } from '@/lib/types/core';
import { getCacheContext } from '@/lib/utils';
import ChannelDetailClient from './ChannelDetailClient';

export async function generateMetadata({ params }: { params: Promise<{ channelId: string }> }) {
    const { channelId } = await params;
    const { env } = getCacheContext();
    const reportGeneratorService = new ReportGeneratorService(env);
    const channels: DiscordChannel[] = await getChannels(env);
    const currentChannel = channels.find((c) => c.id === channelId);
    
    return {
        title: `${currentChannel?.name || 'Channel'} Reports - Fast Takeoff News`,
        description: `Latest breaking news and reports from ${currentChannel?.name || 'this channel'}. Real-time updates as stories develop.`,
        alternates: {
            canonical: `https://news.fasttakeoff.org/current-events/${channelId}`
        },
        robots: {
            index: true, // INDEX these - they contain breaking news
            follow: true
        },
        openGraph: {
            title: `${currentChannel?.name || 'Channel'} Reports - Fast Takeoff News`,
            description: `Latest breaking news and reports from ${currentChannel?.name || 'this channel'}`,
            type: 'article'
        }
    };
}

export default async function ChannelDetailPage({ params }: { params: Promise<{ channelId: string }> }) {
    const { channelId } = await params;
    const { env } = getCacheContext();
    const reportGeneratorService = new ReportGeneratorService(env);

    const channels: DiscordChannel[] = await getChannels(env);
    const currentChannel = channels.find((c) => c.id === channelId) || null;
    console.log('[ChannelDetailPage] currentChannel', currentChannel);

    const reports: Report[] = await reportGeneratorService.cacheService.getAllReportsForChannelFromCache(channelId) || [];

    return <ChannelDetailClient reports={reports} channel={currentChannel} />;
}