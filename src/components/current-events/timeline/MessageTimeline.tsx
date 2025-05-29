"use client";

import { Loader } from "@/components/ui/loader";
import { DiscordMessage } from "@/lib/types/core";
import { useEffect, useState } from "react";
import MessageItem from "./MessageItemTimeline";

interface MessageTimelineProps {
    messages: DiscordMessage[];
    isLoading?: boolean;
}

function groupMessagesByDate(messages: DiscordMessage[]) {
    const groups: Record<string, DiscordMessage[]> = {};
    messages?.forEach(message => {
        const dateStr = new Date(message.timestamp).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        if (!groups[dateStr]) {
            groups[dateStr] = [];
        }
        groups[dateStr].push(message);
    });
    return Object.entries(groups).sort((a, b) =>
        new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
}

export default function MessageTimeline({ messages, isLoading = false }: MessageTimelineProps) {
    const timelineGroups = groupMessagesByDate(messages);
    const [showNoMessages, setShowNoMessages] = useState(false);

    useEffect(() => {
        let timeout: NodeJS.Timeout;

        if (isLoading) {
            setShowNoMessages(false);
        } else if (!messages?.length) {
            // Only show "No messages found" after 7 seconds of no messages
            timeout = setTimeout(() => {
                setShowNoMessages(true);
            }, 7000);
        } else {
            setShowNoMessages(false);
        }

        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [isLoading, messages]);

    if (isLoading || (!messages?.length && !showNoMessages)) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader size="xl" />
            </div>
        );
    }

    if (showNoMessages) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                No messages found
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {timelineGroups.map(([date, dateMessages]) => (
                <div key={date} className="space-y-4">
                    <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2">
                        <h3 className="text-lg font-semibold">{date}</h3>
                    </div>
                    <div className="space-y-4 pl-4 border-l-2 border-secondary-foreground">
                        {dateMessages.map((message, index) => (
                            <div key={message.id} className="relative">
                                {/* Timeline dot */}
                                <div className="absolute -left-[25px] top-1 w-4 h-4 bg-secondary-foreground border-2 border-secondary-foreground rounded-full"></div>
                                {/* Message content */}
                                <div className="pl-4">
                                    <MessageItem
                                        message={message}
                                        index={index}
                                        noAccordion={true}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
} 