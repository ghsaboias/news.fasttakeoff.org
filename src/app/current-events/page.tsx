import { ReportsService } from '@/lib/data/reports-service';
import { getCacheContext } from '@/lib/utils';
import { unstable_cache } from 'next/cache';
import CurrentEventsClient from './CurrentEventsClient';

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
    return {
        title: 'Current Events - News AI World',
        description: 'Latest updates from Discord channels.',
    };
}

const getCachedReports = unstable_cache(
    async () => {
        console.log('[Runtime] Fetching reports for /current-events');
        const { env } = getCacheContext();
        const reportsService = new ReportsService(env);
        const reports = await reportsService.getAllReportsFromCache();
        return reports;
    },
    ['discord-reports'],
    { revalidate: 3600 } // Cache for 1 hour
);

export default async function CurrentEventsPage() {
    const reports = await getCachedReports();
    return (
        <div className="flex flex-col gap-8">
            <CurrentEventsClient reports={reports} />
        </div>
    );
}