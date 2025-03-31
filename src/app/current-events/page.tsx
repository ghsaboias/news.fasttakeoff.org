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

const reportsService = new ReportsService(getCacheContext().env);

export default async function CurrentEventsPage() {
    const reports = await reportsService.getAllReportsFromCache();
    return (
        <div className="flex flex-col gap-8">
            <CurrentEventsClient reports={reports} />
        </div>
    );
}