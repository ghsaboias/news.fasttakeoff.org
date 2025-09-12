"use client";

import ReportCard from "@/components/current-events/ReportCard";
import { Button } from "@/components/ui/button";
import { DiscordChannel } from "@/lib/types/discord";
import { Report } from "@/lib/types/reports";
import { ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function ChannelDetailClient({ reports, channel }: { reports: Report[]; channel: DiscordChannel | null }) {
    const params = useParams();
    const channelId = Array.isArray(params.channelId) ? params.channelId[0] : params.channelId;

    const [clientReports, setClientReports] = useState<Report[]>(reports);
    const [clientChannel, setClientChannel] = useState<DiscordChannel | null>(channel);
    const [isLoading, setIsLoading] = useState(false);

    // Client-side fallback when server-side data is empty or channel is not found
    useEffect(() => {
        if ((!channel || reports.length === 0) && !isLoading && clientReports.length === 0) {
            console.log('[ChannelDetailClient] Fetching data client-side:', {
                hasChannel: !!channel,
                reportsLength: reports.length,
                isLoading,
                clientReportsLength: clientReports.length
            });
            setIsLoading(true);

            // Fetch both reports and channel data in parallel
            Promise.all([
                fetch(`/api/reports?channelId=${channelId}`).then(res => res.ok ? res.json() : []).catch(() => []),
                fetch(`/api/channels`).then(res => res.ok ? res.json() : []).catch(() => [])
            ]).then(([reportsData, channelsData]) => {
                const typedReportsData = reportsData as Report[];
                const typedChannelsData = channelsData as DiscordChannel[];
                console.log('[ChannelDetailClient] Fetched data:', {
                    reportsLength: typedReportsData?.length || 0,
                    channelsLength: typedChannelsData?.length || 0
                });
                setClientReports(typedReportsData || []);
                const foundChannel = typedChannelsData.find((c: DiscordChannel) => c.id === channelId) || null;
                if (!foundChannel) {
                    console.log('[ChannelDetailClient] Channel not found in fetched data:', channelId);
                }
                setClientChannel(foundChannel);
            }).finally(() => {
                setIsLoading(false);
            });
        }
    }, [reports.length, channel, channelId, isLoading, clientReports.length]);

    const sortedReports = useMemo(() => {
        return [...clientReports].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    }, [clientReports]);

    const latestReport = sortedReports[0];
    const olderReports = sortedReports.slice(1);

    const timelineGroups = useMemo(() => {
        const groups: Record<string, Report[]> = {};
        olderReports.forEach(report => {
            const dateStr = new Date(report.generatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC' // Force UTC to prevent hydration mismatches
            });
            if (!groups[dateStr]) {
                groups[dateStr] = [];
            }
            groups[dateStr].push(report);
        });
        return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
    }, [olderReports]);

    if (isLoading) {
        return (
            <div className="p-6 max-w-5xl mx-auto flex flex-col items-center justify-center py-12">
                <p className="text-lg text-muted-foreground">Loading channel data...</p>
            </div>
        );
    }

    if (!channelId || !clientChannel) {
        console.log('[ChannelDetailClient] channelId', channelId);
        console.log('[ChannelDetailClient] channel', clientChannel);
        return (
            <div className="p-6 max-w-5xl mx-auto flex flex-col items-center justify-center py-12">
                <p className="text-lg text-red-500">Channel not found</p>
                <Link href="/current-events" className="mt-4">
                    <Button variant="outline">Back to Current Events</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="mx-auto flex flex-col gap-6 w-[90%] py-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold">{clientChannel.name}</h1>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href={`/current-events/${channelId}/messages`}>
                            <MessageSquare className="h-4 w-4" />
                        </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href={`/current-events/${channelId}`}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
            <div className="space-y-6">
                {latestReport && (
                    <ReportCard report={latestReport} clickableChannel={false} />
                )}
                {timelineGroups.length > 0 && (
                    timelineGroups.map(([date, reportsOnDate]) => (
                        <div key={date} className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-foreground pb-2">
                                <div className="w-2 h-2 rounded-full bg-foreground" />
                                <span className="text-sm font-medium text-foreground">{date}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {reportsOnDate.map((report, index) => (
                                    <ReportCard
                                        report={report}
                                        clickableChannel={false}
                                        key={index}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}