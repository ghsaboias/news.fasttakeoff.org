import { getChannelDetails } from '@/lib/data/channels-service';
import { ReportsService } from '@/lib/data/reports-service';
import { DiscordMessage, Report } from '@/lib/types/core';
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
    let report: Report | null = null;
    let reportMessages = { count: 0, messages: [] as DiscordMessage[] };

    try {
        const { report: fetchedReport, messages } = await reportsService.getReportAndMessages(channelId);
        report = fetchedReport;
        reportMessages = { count: messages.length, messages };
    } catch (error) {
        console.error("Error fetching report:", error);
        // Fallback to empty report is handled by getChannelReport, no need to override here
    }

    return (
        <ChannelDetailClient
            channel={channel}
            report={report}
            messages={reportMessages}
        />
    );
}