import MessagesClient from "./MessagesClient";

interface PageProps {
    params: Promise<{
        channelId: string;
    }>;
}

export default async function MessagesPage({ params }: PageProps) {
    const { channelId } = await params;

    let channel = null;
    let messages = { count: 0, messages: [] };

    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/messages?channelId=${channelId}`, {
            next: { revalidate: 3600 }  // Cache for 1 hour, matching the message update interval
        });
        if (response.ok) {
            const data = await response.json();
            channel = data.channel;
            messages = data.messages;
        }
    } catch (error) {
        console.error('Error fetching messages:', error);
    }
    console.log(channel, messages);

    return (
        <div className="flex flex-col gap-8 w-[90vw] mx-auto py-8">
            <MessagesClient
                channel={channel}
                initialMessages={messages.messages}
                messageCount={messages.count}
            />
        </div>
    );
} 