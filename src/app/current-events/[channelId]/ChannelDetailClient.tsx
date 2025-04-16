"use client";

import ReportCard from "@/components/current-events/ReportCard";
import { Button } from "@/components/ui/button";
import { DiscordChannel, Report } from "@/lib/types/core";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

export default function ChannelDetailClient({ reports, channel }: { reports: Report[]; channel: DiscordChannel | null }) {
    const params = useParams();
    const channelId = Array.isArray(params.channelId) ? params.channelId[0] : params.channelId;

    const sortedReports = useMemo(() => {
        return [...reports].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    }, [reports]);

    const latestReport = sortedReports[0];
    const olderReports = sortedReports.slice(1);

    const timelineGroups = useMemo(() => {
        const groups: Record<string, Report[]> = {};
        olderReports.forEach(report => {
            const dateStr = new Date(report.generatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
            if (!groups[dateStr]) {
                groups[dateStr] = [];
            }
            groups[dateStr].push(report);
        });
        return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
    }, [olderReports]);

    if (!channelId || !channel) {
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
        <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
            <h3 className="text-xl font-bold tracking-tight">{channel.name ?? 'Unknown Channel'}</h3>
            <div className="space-y-6">
                {latestReport && (
                    <div className="hover:shadow-lg transition-shadow border rounded-lg p-4">
                        <Link href={`/current-events/${channelId}/${latestReport.reportId}`}>
                            <h4 className="text-lg font-semibold mb-2">Latest Report</h4>
                            <ReportCard report={latestReport} channelsPage={true} />
                        </Link>
                    </div>
                )}
                {timelineGroups.length > 0 && (
                    timelineGroups.map(([date, reportsOnDate]) => (
                        <div key={date} className="space-y-4">
                            <div className="flex items-center gap-2 border-b pb-1 mb-2">
                                <div className="w-2 h-2 bg-primary rounded-full" />
                                <span className="text-sm font-medium text-muted-foreground">{date}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {reportsOnDate.map((report) => (
                                    <Link key={report.reportId} href={`/current-events/${channelId}/${report.reportId}`}>
                                        <ReportCard report={report} channelsPage={true} />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}