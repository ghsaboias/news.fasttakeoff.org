import { ReportGeneratorService } from '@/lib/data/report-generator-service';
import { getCacheContext } from '@/lib/utils';
import CurrentEventsClient from './CurrentEventsClient';

export const revalidate = 300; // 5 minutes - same as homepage

export async function generateMetadata() {
    return {
        title: 'Current Events - Fast Takeoff News',
        description: 'Latest updates from Discord channels.',
        alternates: {
            canonical: 'https://news.fasttakeoff.org/current-events'
        }
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

        const reportGeneratorService = new ReportGeneratorService(env);
        const reports = await reportGeneratorService.cacheService.getAllReportsFromCache(200);
        return reports || [];
    } catch (error) {
        console.error('Error fetching reports on server:', error);
        return [];
    }
}

export default async function CurrentEventsPage() {
    const reports = await getServerSideData();

    return (
        <div className="flex flex-col gap-8 w-[90vw] mx-auto">
            <CurrentEventsClient reports={reports} />
        </div>
    );
}