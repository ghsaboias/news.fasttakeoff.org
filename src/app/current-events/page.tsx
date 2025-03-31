import { ReportsService } from '@/lib/data/reports-service';
import { getCacheContext } from '@/lib/utils';
import CurrentEventsClient from './CurrentEventsClient';

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
    return {
        title: 'Current Events - News AI World',
        description: 'Latest updates from Discord channels.',
    };
}

async function getReports() {
    console.log('[Runtime] Fetching reports for /current-events');
    const { env } = getCacheContext();
    const reportsService = new ReportsService(env);
    const reports = await reportsService.getAllReportsFromCache();
    return reports;
}

export default async function CurrentEventsPage() {
    const reports = await getReports();
    return (
        <div className="flex flex-col gap-8">
            <CurrentEventsClient reports={reports} />
        </div>
    );
}