import { getChannelDetails } from '@/lib/data/channels-service'; // Updated import
import { ReportsService } from '@/lib/data/reports-service';
import { Report } from '@/lib/types/core';
import { getCacheContext } from '@/lib/utils';
import { notFound } from 'next/navigation';
import ChannelDetailClient from './ChannelDetailClient';

export default async function ChannelDetailPage({ params }: { params: Promise<{ channelId: string }> }) {
    const { channelId } = await params;

    // Fetch channel and messages
    const { channel, messages } = await getChannelDetails(channelId);

    if (!channel) {
        notFound(); // Return 404 if channel is not found
    }

    // Fetch report separately
    const { env } = getCacheContext();
    const reportsService = new ReportsService(env);
    let report: Report | null = null;
    try {
        const { report: newReport } = await reportsService.getChannelReport(channelId);
        report = newReport;
    } catch (error) {
        console.error("Error generating report:", error);
    }

    return (
        <ChannelDetailClient
            channel={channel}
            report={report}
            messages={messages}
        />
    );
}