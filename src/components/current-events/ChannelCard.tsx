"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Report } from "@/lib/data/discord-reports";
import { DiscordChannel, DiscordMessage } from "@/lib/types/core";
import MessagesAccordion from "./MessagesAccordion";
import ReportAccordion from "./ReportAccordion";

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
    fetchMessages: (channelId: string) => Promise<void>;
    generateChannelReport: (channelId: string) => Promise<void>;
}

export default function ChannelCard({
    channel,
    channelData,
    channelReports,
    fetchMessages,
    generateChannelReport,
}: ChannelCardProps) {
    return (
        <Card key={channel.id} className="flex flex-col">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="line-clamp-1">{channel.name}</CardTitle>
                    <Badge variant="outline">
                        Position: {channel.position}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-1">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => fetchMessages(channel.id)}
                            disabled={channelData.get(channel.id)?.loading}
                            variant="outline"
                            size="sm"
                        >
                            {channelData.get(channel.id)?.loading ? "Fetching..." : "Fetch Sources"}
                        </Button>
                        {channelData.get(channel.id)?.messages.length ? (
                            <Button
                                onClick={() => generateChannelReport(channel.id)}
                                disabled={channelReports.get(channel.id)?.loading}
                                variant="outline"
                                size="sm"
                            >
                                {channelReports.get(channel.id)?.loading ? "Generating..." : "Generate Report"}
                            </Button>
                        ) : null}
                    </div>

                    {/* Report Section */}
                    <ReportAccordion reportData={channelReports.get(channel.id)} />

                    {/* Messages Section */}
                    <MessagesAccordion channelDataForMessages={channelData.get(channel.id)} />
                </div>
            </CardContent>
        </Card>
    );
} 