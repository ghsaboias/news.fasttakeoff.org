import { ChannelsService } from '@/lib/data/channels-service';
import { ReportService } from '@/lib/data/report-service';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

interface ChartData {
    timeframe: string;
    channels: {
        channelId: string;
        channelName: string;
        dataPoints: {
            reportId: string;
            timestamp: string;
            messageCount: number;
            headline: string;
        }[];
    }[];
}

export async function GET() {
    try {
        const { env } = await getCacheContext();

        if (!env || !env.REPORTS_CACHE) {
            return NextResponse.json({ error: 'Environment not available' }, { status: 500 });
        }

        const reportService = new ReportService(env);
        const channelsService = new ChannelsService(env);

        // Get all channels
        const channels = await channelsService.getChannels();

        // Initialize data structure for each timeframe
        const chartData: Record<string, ChartData> = {
            '2h': {
                timeframe: '2h',
                channels: []
            },
            '6h': {
                timeframe: '6h',
                channels: []
            }
        };

        // For each channel, get all reports
        for (const channel of channels) {
            // Get reports for 2h timeframe
            const reports2h = await reportService.getAllReportsForChannel(channel.id, '2h');
            if (reports2h.length > 0) {
                chartData['2h'].channels.push({
                    channelId: channel.id,
                    channelName: channel.name,
                    dataPoints: reports2h.map(report => ({
                        reportId: report.reportId,
                        timestamp: report.generatedAt,
                        messageCount: report.messageCount || 0,
                        headline: report.headline
                    })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                });
            }

            // Get reports for 6h timeframe
            const reports6h = await reportService.getAllReportsForChannel(channel.id, '6h');
            if (reports6h.length > 0) {
                chartData['6h'].channels.push({
                    channelId: channel.id,
                    channelName: channel.name,
                    dataPoints: reports6h.map(report => ({
                        reportId: report.reportId,
                        timestamp: report.generatedAt,
                        messageCount: report.messageCount || 0,
                        headline: report.headline
                    })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                });
            }
        }

        // Sort channels by name for consistent display
        chartData['2h'].channels.sort((a, b) => a.channelName.localeCompare(b.channelName));
        chartData['6h'].channels.sort((a, b) => a.channelName.localeCompare(b.channelName));

        return NextResponse.json(chartData, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('Error fetching chart data:', error);
        return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 });
    }
} 