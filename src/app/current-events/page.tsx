import { Report } from '@/lib/types/core';
import CurrentEventsClient from './CurrentEventsClient';
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
    return {
        title: 'Current Events - Fast Takeoff News',
        description: 'Latest updates from Discord channels.',
        alternates: {
            canonical: 'https://news.fasttakeoff.org/current-events'
        }
    };
}

export default async function CurrentEventsPage() {
    let reports: Report[] = [];

    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/reports`, {
            cache: 'no-store'
        });
        if (response.ok) {
            reports = await response.json() as Report[];
        }
    } catch (error) {
        console.error('Error fetching reports on server:', error);
    }

    return (
        <div className="flex flex-col gap-8 w-[90vw] mx-auto">
            <CurrentEventsClient reports={reports} />
        </div>
    );
}