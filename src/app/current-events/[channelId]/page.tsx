import { getChannelDetails } from '@/lib/data/channels-service';
import { ReportsService } from '@/lib/data/reports-service';
import { Report } from '@/lib/types/core';
import { getCacheContext } from '@/lib/utils';
import { notFound } from 'next/navigation';
import ChannelDetailClient from './ChannelDetailClient';

export default async function ChannelDetailPage({ params }: { params: Promise<{ channelId: string }> }) {
    const { channelId } = await params;
    const { env } = getCacheContext();

    // Fetch channel details
    const { channel } = await getChannelDetails(env, channelId);
    if (!channel) {
        notFound(); // Return 404 if channel is not found
    }

    // Fetch report and its associated messages
    const reportsService = new ReportsService(env);
    let reports: Report[] = [];
    try {
        reports = await reportsService.getAllChannelReportsFromCache(channelId);
        console.log(`[CHANNEL] Found ${reports.length} reports for channel ${channelId}`);
        console.log(reports);
        if (reports.length === 0) {
            notFound();
        }
    } catch (error) {
        console.error("Error fetching report:", error);
        // Fallback to empty report is handled by getChannelReport, no need to override here
    }

    return (
        <ChannelDetailClient
            channel={channel}
            reports={reports}
        />
    );
}