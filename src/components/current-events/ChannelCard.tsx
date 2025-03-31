import MessagesAccordion from "@/components/current-events/MessagesAccordion";
import ReportAccordion from "@/components/current-events/ReportAccordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DiscordChannel, DiscordMessage, Report } from "@/lib/types/core";
import { formatTime } from "@/lib/utils";
import Link from "next/link";
interface ChannelCardProps {
    channel: DiscordChannel;
    channelData: Map<string, { count: number; messages: DiscordMessage[]; loading: boolean }>;
    channelReports: Map<string, { report: Report | null; loading: boolean; error: string | null }>;
    isLoading: boolean;
}

export default function ChannelCard({
    channel,
    channelData,
    channelReports,
    isLoading
}: ChannelCardProps) {
    const channelDataEntry = channelData.get(channel.id) || { count: 0, messages: [], loading: false };
    const channelReport = channelReports.get(channel.id) || { report: null, loading: false, error: null };

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg line-clamp-2">{channel.name}</CardTitle>
                    {channelReport.report?.lastMessageTimestamp && (
                        <span className="text-xs text-muted-foreground">
                            {formatTime(channelReport.report.lastMessageTimestamp)}
                        </span>
                    )}
                </div>
                {channelDataEntry.count > 0 && (
                    <CardDescription className="text-sm">
                        {channelDataEntry.count} updates in the last hour
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="flex flex-col ">
                <ReportAccordion channelReport={channelReport} />
                <MessagesAccordion channelData={channelDataEntry} isLoading={isLoading} />
            </CardContent>
            <div className="px-4 mt-auto flex flex-col gap-2">
                <Link href={`/current-events/${channel.id}`}>
                    <Button size="sm" className="w-full">
                        Read more
                    </Button>
                </Link>
            </div>
        </Card>
    );
}