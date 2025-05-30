"use client";

import MessageTimeline from "@/components/current-events/timeline/MessageTimeline";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { DiscordChannel, DiscordMessage } from "@/lib/types/core";
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
                const data = await response.json();
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
            <div className="flex items-center justify-center p-8">
                <Loader size="xl" />
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        {channel.name}
                    </h1>
                    <span className="text-sm text-muted-foreground font-normal">
                        (Showing {displayedMessages.length} of {messageCount} messages)
                    </span>
                </div>
                <Button asChild variant="outline">
                    <Link href="/current-events">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Link>
                </Button>
            </div>

            <MessageTimeline messages={displayedMessages} />

            {hasMore && (
                <div className="flex justify-center pt-4">
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