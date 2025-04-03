"use client";

import { Button } from "@/components/ui/button";
import { DiscordChannel, Report } from "@/lib/types/core";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ChannelDetailClient({ initialReports, initialChannel }: { initialReports: Report[], initialChannel: DiscordChannel | null }) {
    const params = useParams();
    const channelId = Array.isArray(params.channelId) ? params.channelId[0] : params.channelId;

    const [reports, setReports] = useState<Report[]>(initialReports);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [channel, setChannel] = useState<DiscordChannel | null>(initialChannel);

    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                setError(null);

                const channelsResponse = await fetch('/api/channels');
                if (!channelsResponse.ok) throw new Error('Failed to fetch channels');
                const channels = await channelsResponse.json();
                const currentChannel = channels.find((c: DiscordChannel) => c.id === channelId);

                if (!currentChannel) {
                    setError('Channel not found');
                    return;
                }
                setChannel(currentChannel);

                const reportsResponse = await fetch(`/api/reports?channelId=${channelId}`);
                if (!reportsResponse.ok) throw new Error('Failed to fetch reports');
                const data = await reportsResponse.json();
                setReports(Array.isArray(data) ? data : data.report ? [data.report] : []);
            } catch (error) {
                console.error('Error fetching data:', error);
                setError('Failed to load data');
            } finally {
                setIsLoading(false);
            }
        }

        if (channelId) {
            fetchData();
        }
    }, [channelId]);

    if (isLoading) {
        return (
            <div className="p-6 max-w-5xl mx-auto flex flex-col items-center justify-center py-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading channel information...</p>
            </div>
        );
    }

    if (error || !channelId) {
        return (
            <div className="p-6 max-w-5xl mx-auto flex flex-col items-center justify-center py-12">
                <p className="text-lg text-red-500">{error || 'Channel not found'}</p>
                <Link href="/current-events" className="mt-4">
                    <Button variant="outline">
                        Back to Current Events
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto gap-4 flex flex-col">
            <h3 className="text-xl font-bold tracking-tight">{channel?.name ?? 'Unknown Channel'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reports && reports.length > 0 ? (
                    reports.map((report) => (
                        <div className="border border-gray-200 rounded-lg p-4 overflow-scroll gap-2 flex flex-col" key={report.timestamp}>
                            <h1 className="text-2xl font-bold">{report.headline?.toUpperCase()}</h1>
                            <h2 className="text-lg font-medium text-muted-foreground">{report.city}</h2>
                            <div className="prose prose-zinc max-w-none overflow-y-auto">
                                {report.body.slice(0, 100)}...
                            </div>
                            <Button asChild>
                                <Link href={`/current-events/${channelId}/${report.timestamp}`}>
                                    Read More
                                </Link>
                            </Button>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center py-8">
                        <p className="text-lg text-muted-foreground">No reports found for this channel</p>
                    </div>
                )}
            </div>
        </div>
    );
}