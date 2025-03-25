"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DiscordChannel, DiscordMessage, Report } from "@/lib/types/core";
import { Clock, MessageSquare } from "lucide-react";
import Link from "next/link";

interface ChannelCardProps {
    channel: DiscordChannel;
    channelData: Map<string, {
        count: number;
        messages: DiscordMessage[];
        loading: boolean
    }>;
    channelReports: Map<string, {
        report: Report | null;
        loading: boolean;
        error: string | null
    }>;
}

export default function ChannelCard({
    channel,
    channelData,
    channelReports,
}: ChannelCardProps) {
    // Format timestamp if available
    const formattedTimestamp = channel.lastMessageTimestamp
        ? new Date(channel.lastMessageTimestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
        : null;

    const reportData = channelReports.get(channel.id);
    const messageCount = channelData.get(channel.id)?.count ?? channel.messageCount ?? 0;
    const hasReport = reportData?.report && !reportData?.error;

    return (
        <Link href={`/current-events/${channel.id}`}>
            <Card className="h-full flex flex-col hover:bg-accent/5 hover:shadow-md transition-all duration-200 cursor-pointer gap-2">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="line-clamp-1 text-lg font-semibold">{channel.name}</CardTitle>
                    </div>
                    {hasReport && (
                        <div className="mt-2">
                            <div className="font-semibold text-base line-clamp-1">
                                {reportData?.report?.headline}
                            </div>
                            {reportData?.report?.city && (
                                <div className="text-sm text-muted-foreground mt-1">
                                    {reportData.report.city}
                                </div>
                            )}
                        </div>
                    )}
                </CardHeader>

                <CardContent className="pb-2">
                    {hasReport && reportData?.report?.body && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                            {reportData.report.body}
                        </p>
                    )}
                    {!hasReport && messageCount > 0 && (
                        <div className="flex items-center text-sm text-muted-foreground">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            <span>
                                {messageCount} message{messageCount !== 1 ? 's' : ''} in the last hour
                            </span>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="pt-0">
                    <div className="w-full flex justify-between items-center text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            {messageCount > 0 && hasReport && (
                                <div className="flex items-center">
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                    <span>{messageCount}</span>
                                </div>
                            )}
                            {reportData?.report?.timestamp && (
                                <span>
                                    Generated: {channel.lastMessageTimestamp
                                        ? new Date(channel.lastMessageTimestamp).toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: false
                                        })
                                        : null}
                                </span>
                            )}
                        </div>
                        {formattedTimestamp && (
                            <div className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                <span>Last update: {formattedTimestamp}</span>
                            </div>
                        )}
                    </div>
                </CardFooter>
            </Card>
        </Link>
    );
} 