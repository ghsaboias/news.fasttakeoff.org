import MessagesClient from "./MessagesClient";

interface PageProps {
    params: Promise<{
        channelId: string;
    }>;
}

export async function generateMetadata({ params }: PageProps) {
    const { channelId } = await params;

    return {
        title: 'Channel Messages - Fast Takeoff News',
        description: 'View channel messages',
        alternates: {
            canonical: `https://news.fasttakeoff.org/current-events/${channelId}/messages`
        },
        robots: {
            index: false, // Don't index message pages
            follow: true
        }
    };
}

export default async function MessagesPage({ params }: PageProps) {
    const { channelId } = await params;

    return (
        <div className="flex flex-col gap-8 my-8 max-w-[90vw]">
            <MessagesClient channelId={channelId} />
        </div>
    );
} 