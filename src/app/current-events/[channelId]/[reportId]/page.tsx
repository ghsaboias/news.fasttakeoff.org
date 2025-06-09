import { getChannels } from '@/lib/data/channels-service';
import { ReportGeneratorService } from '@/lib/data/report-generator-service';
import { getCacheContext } from '@/lib/utils';
import ReportClient from './ReportClient';

export async function generateMetadata({ params }: { params: Promise<{ channelId: string, reportId: string }> }) {
    const { channelId, reportId } = await params;
    const { env } = getCacheContext();
    const reportGeneratorService = new ReportGeneratorService(env);

    // Get the specific report for SEO optimization
    const reports = await reportGeneratorService.cacheService.getAllReportsForChannelFromCache(channelId) || [];
    const report = reports.find(r => r.reportId === reportId);
    const channels = await getChannels(env);
    const channel = channels.find(c => c.id === channelId);

    if (!report) {
        return {
            title: 'Breaking News Report - Fast Takeoff News',
            description: 'Real-time news analysis and breaking story coverage.',
            alternates: {
                canonical: `https://news.fasttakeoff.org/current-events/${channelId}/${reportId}`
            }
        };
    }

    // Extract key topics/keywords from report content for SEO
    const contentPreview = report.body.substring(0, 160) || 'Breaking news analysis';
    const seoTitle = report.headline ?
        `${report.headline} - Fast Takeoff News` :
        `Breaking: ${channel?.name || 'News'} Report - Fast Takeoff News`;

    return {
        title: seoTitle,
        description: contentPreview,
        alternates: {
            canonical: `https://news.fasttakeoff.org/current-events/${channelId}/${reportId}`
        },
        robots: {
            index: true, // CRITICAL: Index breaking news reports
            follow: true
        },
        openGraph: {
            title: seoTitle,
            description: contentPreview,
            type: 'article',
            publishedTime: report.generatedAt,
            section: 'Breaking News'
        },
        twitter: {
            card: 'summary_large_image',
            title: seoTitle,
            description: contentPreview
        },
        keywords: [
            'breaking news',
            'real-time news',
            'news analysis',
            channel?.name || 'current events',
            ...(report?.headline?.split(' ').slice(0, 5) || []) // Extract keywords from title
        ].join(', ')
    };
}

export default function ReportDetailPage() {
    return <ReportClient />;
}