"use client";

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
                        <div className="border border-gray-200 rounded-lg p-4 overflow-scroll gap-2 flex flex-col max-h-[300px]" key={report.reportId}>
                            <div className="min-h-[70px] flex items-center">
                                <h1 className="text-2xl font-bold line-clamp-4 sm:line-clamp-2 break-words">
                                    {report.headline?.toUpperCase()}
                                </h1>
                            </div>
                            <h2 className="text-lg font-medium text-muted-foreground">{report.city}</h2>
                            <div className="prose prose-zinc max-w-none overflow-y-auto">
                                {report.body}
                            </div>
                            <Button asChild>
                                <Link href={`/current-events/${channelId}/${report.reportId}`}>Read More</Link>
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