import { ServiceFactory } from '@/lib/services/ServiceFactory';
import { DiscordChannel } from '@/lib/types/discord';
import { Report } from '@/lib/types/reports';
import { getCacheContext } from '@/lib/utils';
import { notFound } from 'next/navigation';
import ChannelDetailClient from './ChannelDetailClient';

// ISR: Revalidate every 10 minutes for channel pages
export const revalidate = 600;

// Pre-generate channel pages
export async function generateStaticParams() {
    try {
        // Detect build environment - skip static generation during build
        const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';
        if (isBuildTime) {
            console.log('[BUILD] Skipping static generation for channel pages during build phase');
            return [];
        }

        const { env } = await getCacheContext();
        if (!env) return [];

        const factory = ServiceFactory.getInstance(env);
        const channelsService = factory.createChannelsService();
        const channels = await channelsService.getChannels();
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

        const factory = ServiceFactory.getInstance(env);
        const channelsService = factory.createChannelsService();
        const channels: DiscordChannel[] = await channelsService.getChannels();
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
                type: 'article',
                images: [
                    {
                        url: 'https://news.fasttakeoff.org/images/og-screenshot.webp',
                        width: 1200,
                        height: 630,
                        alt: 'Fast Takeoff News - AI-powered news for everyone',
                    },
                ],
            },
            twitter: {
                card: 'summary_large_image',
                title: `${currentChannel?.name || 'Channel'} Reports - Fast Takeoff News`,
                description: `Latest breaking news and reports from ${currentChannel?.name || 'this channel'}`,
                images: [
                    {
                        url: 'https://news.fasttakeoff.org/images/og-screenshot.webp',
                        width: 1200,
                        height: 630,
                        alt: 'Fast Takeoff News - AI-powered news for everyone',
                        type: 'image/webp',
                    },
                ],
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

    const { env } = await getCacheContext();

    // Local dev fallback when KV isn't available
    if (!env || !env.CHANNELS_CACHE || !env.REPORTS_CACHE) {
        console.log('[SERVER] Cloudflare environment not available, using empty data');
        return <ChannelDetailClient reports={[]} channel={null} />;
    }

    const factory = ServiceFactory.getInstance(env);
    const reportService = factory.createReportService();
    const channelsService = factory.createChannelsService();

    const channels: DiscordChannel[] = await channelsService.getChannels();
    const currentChannel = channels.find((c) => c.id === channelId) || null;

    if (!currentChannel) {
        notFound();
    }

    const reports: Report[] = await reportService.getAllReportsForChannel(channelId) || [];

    return <ChannelDetailClient reports={reports} channel={currentChannel} />;
}