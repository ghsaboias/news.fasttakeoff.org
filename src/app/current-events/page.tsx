import { ReportService } from '@/lib/data/report-service';
import { getCacheContext } from '@/lib/utils';
import dynamic from 'next/dynamic';

// Dynamically import the current events client component
const CurrentEventsClient = dynamic(() => import('./CurrentEventsClient'), {
    loading: () => (
        <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading current events...</span>
        </div>
    ),
    ssr: true // Keep SSR for content
});

export const revalidate = 300; // 5 minutes - same as homepage

export async function generateMetadata() {
    return {
        title: 'Current Events - Fast Takeoff News',
        description: 'Latest updates from on-the-ground sources.',
        alternates: {
            canonical: 'https://news.fasttakeoff.org/current-events'
        },
        openGraph: {
            title: 'Current Events - Fast Takeoff News',
            description: 'Latest updates from on-the-ground sources.',
            type: 'website',
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
            title: 'Current Events - Fast Takeoff News',
            description: 'Latest updates from on-the-ground sources.',
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
    };
}

async function getServerSideData() {
    try {
        const { env } = await getCacheContext();

        // Check if we have a valid Cloudflare environment
        if (!env || !env.REPORTS_CACHE) {
            console.log('[SERVER] Cloudflare environment not available, skipping server-side data fetch');
            return [];
        }

        const reportService = new ReportService(env);
        const reports = await reportService.getLatestReportPerChannelWithCache();
        return reports || [];
    } catch (error) {
        console.error('Error fetching reports on server:', error);
        return [];
    }
}

export default async function CurrentEventsPage() {
    const reports = await getServerSideData();

    return (
        <div className="flex flex-col gap-8 my-8 max-w-[90vw]">
            <CurrentEventsClient reports={reports} />
        </div>
    );
}