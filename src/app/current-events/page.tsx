import CurrentEventsClient from './CurrentEventsClient';

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
    return {
        title: 'Current Events - Fast Takeoff News',
        description: 'Latest updates from Discord channels.',
    };
}

export default async function CurrentEventsPage() {
    let reports = [];

    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/reports`, {
            cache: 'no-store'
        });
        if (response.ok) {
            reports = await response.json();
        }
    } catch (error) {
        console.error('Error fetching reports on server:', error);
    }

    return (
        <div className="flex flex-col gap-8">
            <CurrentEventsClient reports={reports} />
        </div>
    );
}