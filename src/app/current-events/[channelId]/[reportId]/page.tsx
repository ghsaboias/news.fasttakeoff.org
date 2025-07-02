import { getChannels } from '@/lib/data/channels-service';
import { ReportService } from '@/lib/data/report-service';
import { getCacheContext } from '@/lib/utils';
import { notFound } from 'next/navigation';
import ReportClient from './ReportClient';

// ISR: Revalidate every 5 minutes for breaking news
export const revalidate = 300;

// Pre-generate some popular report pages
export async function generateStaticParams() {
    try {
        // Detect build environment - skip static generation during build
        const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';
        if (isBuildTime) {
            console.log('[BUILD] Skipping static generation for report pages during build phase');
            return [];
        }

        const { env } = await getCacheContext();
        if (!env) return [];

        const reportService = new ReportService(env);
        const channels = await getChannels(env);

        // Get recent reports from top 5 channels
        const params: Array<{ channelId: string; reportId: string }> = [];
        for (const channel of channels.slice(0, 5)) {
            const reports = await reportService.getAllReportsForChannel(channel.id);
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

        const reportService = new ReportService(env);

        // Get the specific report for SEO optimization
        const reports = await reportService.getAllReportsForChannel(channelId) || [];
        const report = reports.find(r => r.reportId === reportId);
        const channels = await getChannels(env);
        const channel = channels.find(c => c.id === channelId);

        if (!report || !channel) {
            // Unknown report/channel – supply minimal metadata and prevent indexing.
            return {
                title: 'Report Not Found - Fast Takeoff News',
                description: 'The requested report could not be found.',
                robots: { index: false, follow: false },
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
                section: 'Breaking News',
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
                title: seoTitle,
                description: contentPreview,
                images: [
                    {
                        url: 'https://news.fasttakeoff.org/images/og-screenshot.webp',
                        width: 1200,
                        height: 630,
                        alt: 'Fast Takeoff News - AI-powered news for everyone',
                        type: 'image/webp',
                    },
                ],
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

    const { env } = await getCacheContext();

    // Fallback to client-only rendering when Cloudflare KV isn't available (local dev)
    if (!env || !env.REPORTS_CACHE || !env.CHANNELS_CACHE) {
        console.log('[SERVER] Cloudflare environment not available, using client-side rendering');
        return <ReportClient />;
    }

    const reportService = new ReportService(env);

    // Get the specific report for structured data
    const reports = await reportService.getAllReportsForChannel(channelId) || [];
    const report = reports.find(r => r.reportId === reportId);
    const channels = await getChannels(env);
    const channel = channels.find(c => c.id === channelId);

    if (!report || !channel) {
        notFound();
    }

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
            image: 'https://news.fasttakeoff.org/images/og-screenshot.webp',
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
}