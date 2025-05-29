"use client";

import MessageTimeline from "@/components/current-events/timeline/MessageTimeline";
import { Button } from "@/components/ui/button";
import { DiscordChannel, DiscordMessage } from "@/lib/types/core";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface MessagesClientProps {
    channel: DiscordChannel | null;
    initialMessages: DiscordMessage[];
    messageCount: number;
}

const MESSAGES_PER_PAGE = 20;

export default function MessagesClient({
    channel,
    initialMessages,
    messageCount,
}: MessagesClientProps) {
    const [displayedMessages, setDisplayedMessages] = useState(initialMessages.slice(0, MESSAGES_PER_PAGE));
    const [currentPage, setCurrentPage] = useState(1);

    const loadMore = () => {
        const nextPage = currentPage + 1;
        const start = 0;
        const end = nextPage * MESSAGES_PER_PAGE;
        setDisplayedMessages(initialMessages.slice(start, end));
        setCurrentPage(nextPage);
    };

    const hasMore = displayedMessages.length < messageCount;

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