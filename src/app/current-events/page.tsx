import CurrentEventsClient from './CurrentEventsClient';

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
    return {
        title: 'Current Events - News AI World',
        description: 'Latest updates from Discord channels.',
    };
}

export default async function CurrentEventsPage() {
    return (
        <CurrentEventsClient />
    );
}