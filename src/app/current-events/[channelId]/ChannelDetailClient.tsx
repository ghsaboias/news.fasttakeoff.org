"use client";

import ReportCard from "@/components/current-events/ReportCard";
import { Button } from "@/components/ui/button";
import { DiscordChannel, Report } from "@/lib/types/core";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ChannelDetailClient({ reports, channel }: { reports: Report[], channel: DiscordChannel | null }) {
    const params = useParams();
    const channelId = Array.isArray(params.channelId) ? params.channelId[0] : params.channelId;

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
        <div className="p-6 max-w-5xl mx-auto gap-4 flex flex-col">
            <h3 className="text-xl font-bold tracking-tight">{channel.name ?? 'Unknown Channel'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reports && reports.length > 0 ? (
                    reports.map((report) => (
                        <ReportCard key={report.reportId} report={report} channelsPage={true} />
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