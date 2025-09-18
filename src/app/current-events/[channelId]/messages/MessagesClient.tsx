"use client";

import MessageTimeline from "@/components/current-events/timeline/MessageTimeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscordChannel, DiscordMessage } from "@/lib/types/discord";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface MessagesClientProps {
    channelId: string;
}

const MESSAGES_PER_PAGE = 20;

export default function MessagesClient({
    channelId
}: MessagesClientProps) {
    const [channel, setChannel] = useState<DiscordChannel | null>(null);
    const [allMessages, setAllMessages] = useState<DiscordMessage[]>([]);
    const [displayedMessages, setDisplayedMessages] = useState<DiscordMessage[]>([]);
    const [messageCount, setMessageCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchMessages = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/messages?channelId=${channelId}`);
                if (!response.ok) throw new Error('Failed to fetch messages');
                const data = await response.json() as { channel: DiscordChannel; messages: { messages: DiscordMessage[]; count: number } };
                setChannel(data.channel);
                setAllMessages(data.messages.messages);
                setDisplayedMessages(data.messages.messages.slice(0, MESSAGES_PER_PAGE));
                setMessageCount(data.messages.count);
                setCurrentPage(1);
            } catch (error) {
                console.error('Error fetching messages:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMessages();
    }, [channelId]);

    const loadMore = () => {
        const nextPage = currentPage + 1;
        const end = nextPage * MESSAGES_PER_PAGE;
        setDisplayedMessages(allMessages.slice(0, end));
        setCurrentPage(nextPage);
    };

    const hasMore = displayedMessages.length < messageCount;

    if (isLoading) {
        return (
            <div className="space-y-4 p-8">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="border rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (!channel) {
        return (
            <div className="flex flex-col items-center justify-center gap-4">
                <p className="text-lg text-muted-foreground">Channel not found</p>
                <Button asChild variant="outline">
                    <Link href="/current-events">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Current Events
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        {channel.name}
                    </h1>
                    <span className="text-sm text-foreground font-normal">
                        (Showing {displayedMessages.length} of {messageCount} messages)
                    </span>
                </div>
                <Button asChild variant="outline">
                    <Link href={`/current-events/${channelId}`}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
            </div>

            <MessageTimeline messages={displayedMessages} channelId={channelId} />

            {hasMore && (
                <div className="flex justify-center pt-8">
                    <Button
                        onClick={loadMore}
                        variant="outline"
                    >
                        Load More Messages
                    </Button>
                </div>
            )}
        </div>
    );
} 