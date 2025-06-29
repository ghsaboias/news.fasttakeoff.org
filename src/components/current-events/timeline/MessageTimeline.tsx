"use client";

import { DiscordMessage } from "@/lib/types/core";
import MessageItem from "./MessageItemTimeline";

interface MessageTimelineProps {
    messages: DiscordMessage[];
    channelId?: string;
}

function groupMessagesByDate(messages: DiscordMessage[]) {
    const groups: Record<string, DiscordMessage[]> = {};
    messages?.forEach(message => {
        const dateStr = new Date(message.timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC' // Force UTC to prevent hydration mismatches
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

export default function MessageTimeline({ messages, channelId }: MessageTimelineProps) {
    const timelineGroups = groupMessagesByDate(messages);

    if (!messages.length) {
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
                    <div className="space-y-4 pl-4 border-l-2 border-foreground">
                        {dateMessages.map((message, index) => (
                            <div key={message.id} className="relative">
                                {/* Timeline dot */}
                                <div className="absolute -left-[25px] top-1 w-4 h-4 bg-foreground border-2 border-foreground rounded-full"></div>
                                {/* Message content */}
                                <div className="pl-4">
                                    <MessageItem
                                        message={message}
                                        index={index}
                                        noAccordion={true}
                                        channelId={channelId}
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