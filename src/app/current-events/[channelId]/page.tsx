import { getChannels } from '@/lib/data/channels-service';
import { ReportGeneratorService } from '@/lib/data/report-generator-service';
import { DiscordChannel, Report } from '@/lib/types/core';
import { getCacheContext } from '@/lib/utils';
import ChannelDetailClient from './ChannelDetailClient';

// ISR: Revalidate every 10 minutes for channel pages
export const revalidate = 600;

// Pre-generate channel pages
export async function generateStaticParams() {
    try {
        const { env } = await getCacheContext();
        if (!env) return [];

        const channels = await getChannels(env);
        // Generate top 10 most active channels
        return channels.slice(0, 10).map(channel => ({
            channelId: channel.id
        }));
    } catch (error) {
        console.error('Error generating static params for channels:', error);
        return [];
    }
}

export async function generateMetadata({ params }: { params: Promise<{ channelId: string }> }) {
    const { channelId } = await params;

    try {
        const { env } = await getCacheContext();

        // Check if we have a valid Cloudflare environment
        if (!env || !env.CHANNELS_CACHE) {
            return {
                title: 'Channel Reports - Fast Takeoff News',
                description: 'Latest breaking news and reports from this channel. Real-time updates as stories develop.',
                alternates: {
                    canonical: `https://news.fasttakeoff.org/current-events/${channelId}`
                }
            };
        }

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
    } catch (error) {
        console.error('Error generating metadata:', error);
        return {
            title: 'Channel Reports - Fast Takeoff News',
            description: 'Latest breaking news and reports from this channel. Real-time updates as stories develop.',
            alternates: {
                canonical: `https://news.fasttakeoff.org/current-events/${channelId}`
            }
        };
    }
}

export default async function ChannelDetailPage({ params }: { params: Promise<{ channelId: string }> }) {
    const { channelId } = await params;

    try {
        const { env } = await getCacheContext();

        // Check if we have a valid Cloudflare environment
        if (!env || !env.CHANNELS_CACHE || !env.REPORTS_CACHE) {
            console.log('[SERVER] Cloudflare environment not available, using empty data');
            return <ChannelDetailClient reports={[]} channel={null} />;
        }

        const reportGeneratorService = new ReportGeneratorService(env);

        const channels: DiscordChannel[] = await getChannels(env);
        const currentChannel = channels.find((c) => c.id === channelId) || null;
        console.log('[ChannelDetailPage] currentChannel', currentChannel);

        const reports: Report[] = await reportGeneratorService.cacheService.getAllReportsForChannelFromCache(channelId) || [];

        return <ChannelDetailClient reports={reports} channel={currentChannel} />;
    } catch (error) {
        console.error('Error in ChannelDetailPage:', error);
        return <ChannelDetailClient reports={[]} channel={null} />;
    }
}