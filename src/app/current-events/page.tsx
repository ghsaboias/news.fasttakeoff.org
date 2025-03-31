import CurrentEventsClient from './CurrentEventsClient';

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
    return {
        title: 'Current Events - News AI World',
        description: 'Latest updates from Discord channels.',
    };
}

export default function CurrentEventsPage() {
    return (
        <div className="flex flex-col gap-8">
            <CurrentEventsClient reports={[]} />
        </div>
    );
}