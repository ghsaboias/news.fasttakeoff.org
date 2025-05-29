import MessagesClient from "./MessagesClient";

interface PageProps {
    params: Promise<{
        channelId: string;
    }>;
}

export default async function MessagesPage({ params }: PageProps) {
    const { channelId } = await params;

    return (
        <div className="flex flex-col gap-8 w-[90vw] mx-auto py-8">
            <MessagesClient channelId={channelId} />
        </div>
    );
} 