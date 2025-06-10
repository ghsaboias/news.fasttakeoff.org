import { getChannels } from '@/lib/data/channels-service';
import { ReportGeneratorService } from '@/lib/data/report-generator-service';
import { getCacheContext } from '@/lib/utils';
import ReportClient from './ReportClient';

// ISR: Revalidate every 5 minutes for breaking news
export const revalidate = 300;

// Pre-generate some popular report pages
export async function generateStaticParams() {
    try {
        const { env } = await getCacheContext();
        if (!env) return [];

        const reportGeneratorService = new ReportGeneratorService(env);
        const channels = await getChannels(env);

        // Get recent reports from top 5 channels
        const params: Array<{ channelId: string; reportId: string }> = [];
        for (const channel of channels.slice(0, 5)) {
            const reports = await reportGeneratorService.cacheService.getAllReportsForChannelFromCache(channel.id);
            if (reports) {
                // Get 3 most recent reports per channel
                reports.slice(0, 3).forEach(report => {
                    params.push({
                        channelId: channel.id,
                        reportId: report.reportId
                    });
                });
            }
        }
        return params.slice(0, 20); // Limit to 20 pre-generated pages
    } catch (error) {
        console.error('Error generating static params:', error);
        return [];
    }
}

export async function generateMetadata({ params }: { params: Promise<{ channelId: string, reportId: string }> }) {
    const { channelId, reportId } = await params;

    try {
        const { env } = await getCacheContext();

        // Check if we have a valid Cloudflare environment
        if (!env || !env.REPORTS_CACHE || !env.CHANNELS_CACHE) {
            return {
                title: 'Breaking News Report - Fast Takeoff News',
                description: 'Real-time news analysis and breaking story coverage.',
                alternates: {
                    canonical: `https://news.fasttakeoff.org/current-events/${channelId}/${reportId}`
                }
            };
        }

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
    } catch (error) {
        console.error('Error generating metadata:', error);
        return {
            title: 'Breaking News Report - Fast Takeoff News',
            description: 'Real-time news analysis and breaking story coverage.',
            alternates: {
                canonical: `https://news.fasttakeoff.org/current-events/${channelId}/${reportId}`
            }
        };
    }
}

export default async function ReportDetailPage({ params }: { params: Promise<{ channelId: string, reportId: string }> }) {
    const { channelId, reportId } = await params;

    try {
        const { env } = await getCacheContext();

        // Check if we have a valid Cloudflare environment
        if (!env || !env.REPORTS_CACHE || !env.CHANNELS_CACHE) {
            console.log('[SERVER] Cloudflare environment not available, using client-side rendering');
            return (
                <>
                    <ReportClient />
                </>
            );
        }

        const reportGeneratorService = new ReportGeneratorService(env);

        // Get the specific report for structured data
        const reports = await reportGeneratorService.cacheService.getAllReportsForChannelFromCache(channelId) || [];
        const report = reports.find(r => r.reportId === reportId);
        const channels = await getChannels(env);
        const channel = channels.find(c => c.id === channelId);

        // Generate structured data for the report
        let structuredData = null;
        if (report) {
            structuredData = {
                '@context': 'https://schema.org',
                '@type': 'NewsArticle',
                headline: report.headline || `Breaking: ${channel?.name || 'News'} Report`,
                description: report.body.substring(0, 160) || 'Breaking news analysis',
                articleBody: report.body,
                datePublished: report.generatedAt,
                dateModified: report.generatedAt,
                author: {
                    '@type': 'Organization',
                    name: 'Fast Takeoff News',
                    url: 'https://news.fasttakeoff.org'
                },
                publisher: {
                    '@type': 'Organization',
                    name: 'Fast Takeoff News',
                    logo: {
                        '@type': 'ImageObject',
                        url: 'https://news.fasttakeoff.org/images/logo.png',
                        width: 512,
                        height: 512
                    }
                },
                mainEntityOfPage: {
                    '@type': 'WebPage',
                    '@id': `https://news.fasttakeoff.org/current-events/${channelId}/${reportId}`
                },
                articleSection: 'Breaking News',
                keywords: [
                    'breaking news',
                    'real-time news',
                    'news analysis',
                    channel?.name || 'current events',
                    ...(report?.headline?.split(' ').slice(0, 8) || [])
                ].filter(Boolean).join(', '),
                ...(report.city && {
                    contentLocation: {
                        '@type': 'Place',
                        name: report.city
                    }
                })
            };
        }

        return (
            <>
                {structuredData && (
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                    />
                )}
                <ReportClient />
            </>
        );
    } catch (error) {
        console.error('Error in ReportDetailPage:', error);
        return (
            <>
                <ReportClient />
            </>
        );
    }
}