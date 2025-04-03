import { ReportsService } from '@/lib/data/reports-service';
import { getCacheContext } from '@/lib/utils';
import ChannelDetailClient from './ChannelDetailClient';

export async function generateMetadata({ params }: { params: { channelId: string } }) {
    return {
        title: `Channel Details - News AI World`,
        description: 'View reports for this channel',
    };
}

export async function getServerSideProps({ params }: { params: { channelId: string } }) {
    const { env } = getCacheContext();
    const reportsService = new ReportsService(env);
    const channelsResponse = await fetch('/api/channels', { cache: 'no-store' });
    const channels = await channelsResponse.json();
    const currentChannel = channels.find((c: any) => c.id === params.channelId);
    const reports = await reportsService.getAllReportsForChannelFromCache(params.channelId);
    return {
        props: {
            initialReports: reports || [],
            initialChannel: currentChannel || null,
        },
    };
}

export default function ChannelDetailPage({ initialReports, initialChannel }: { initialReports: any[]; initialChannel: any }) {
    return <ChannelDetailClient initialReports={initialReports} initialChannel={initialChannel} />;
}